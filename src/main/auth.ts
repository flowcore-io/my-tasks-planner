import { BrowserWindow, app, safeStorage } from 'electron'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { net } from 'electron'

const KEYCLOAK_BASE = 'https://auth.flowcore.io/realms/memory-mesh'
const CLIENT_ID = 'mcp_oauth_client'
const REDIRECT_URI = 'http://localhost:39847/callback'
const AUTH_URL = `${KEYCLOAK_BASE}/protocol/openid-connect/auth`
const TOKEN_URL = `${KEYCLOAK_BASE}/protocol/openid-connect/token`
const LOGOUT_URL = `${KEYCLOAK_BASE}/protocol/openid-connect/logout`

let accessToken: string | null = null
let refreshToken: string | null = null
let expiresAt: number | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null
let tokenChangedCallback: ((token: string | null) => void) | null = null

// --- Token persistence ---

interface StoredTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

function getTokenFilePath(): string {
  return path.join(app.getPath('userData'), 'auth-tokens.enc')
}

function saveTokensToDisk(): void {
  if (!accessToken || !refreshToken || !expiresAt) {
    clearTokensFromDisk()
    return
  }

  const data: StoredTokens = { accessToken, refreshToken, expiresAt }
  const json = JSON.stringify(data)

  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(json)
      fs.writeFileSync(getTokenFilePath(), encrypted)
    } else {
      // Fallback: store as plain JSON (less secure but functional)
      fs.writeFileSync(getTokenFilePath(), json, 'utf-8')
    }
  } catch (err) {
    console.error('Failed to save auth tokens:', err)
  }
}

function loadTokensFromDisk(): StoredTokens | null {
  const filePath = getTokenFilePath()
  if (!fs.existsSync(filePath)) return null

  try {
    const raw = fs.readFileSync(filePath)
    let json: string

    if (safeStorage.isEncryptionAvailable()) {
      json = safeStorage.decryptString(raw)
    } else {
      json = raw.toString('utf-8')
    }

    return JSON.parse(json) as StoredTokens
  } catch (err) {
    console.error('Failed to load auth tokens:', err)
    clearTokensFromDisk()
    return null
  }
}

function clearTokensFromDisk(): void {
  try {
    const filePath = getTokenFilePath()
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch {
    // ignore
  }
}

// --- PKCE helpers ---

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url')
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url')
}

// --- Token endpoint ---

async function postTokenEndpoint(
  body: Record<string, string>
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const params = new URLSearchParams(body)

  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'POST',
      url: TOKEN_URL,
    })
    request.setHeader('Content-Type', 'application/x-www-form-urlencoded')

    let responseData = ''
    request.on('response', (response) => {
      response.on('data', (chunk) => {
        responseData += chunk.toString()
      })
      response.on('end', () => {
        if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
          try {
            resolve(JSON.parse(responseData))
          } catch {
            reject(new Error('Failed to parse token response'))
          }
        } else {
          reject(new Error(`Token request failed: ${response.statusCode} ${responseData}`))
        }
      })
    })
    request.on('error', reject)
    request.write(params.toString())
    request.end()
  })
}

// --- Token management ---

function setTokens(tokenData: { access_token: string; refresh_token: string; expires_in: number }): void {
  accessToken = tokenData.access_token
  refreshToken = tokenData.refresh_token
  expiresAt = Date.now() + tokenData.expires_in * 1000
  scheduleRefresh(tokenData.expires_in)
  saveTokensToDisk()
  tokenChangedCallback?.(accessToken)
}

async function exchangeCode(code: string, codeVerifier: string): Promise<void> {
  const tokenData = await postTokenEndpoint({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier,
  })
  setTokens(tokenData)
}

function scheduleRefresh(expiresIn: number): void {
  if (refreshTimer) clearTimeout(refreshTimer)
  // Refresh 30 seconds before expiry
  const delay = Math.max((expiresIn - 30) * 1000, 5000)
  refreshTimer = setTimeout(() => {
    refreshAccessToken().catch((err) => {
      console.error('Proactive token refresh failed:', err)
      accessToken = null
      refreshToken = null
      expiresAt = null
      clearTokensFromDisk()
      tokenChangedCallback?.(null)
    })
  }, delay)
}

// --- Public API ---

/**
 * Initialize auth on app startup. Loads persisted tokens and attempts refresh.
 * Returns true if a valid session was restored.
 */
export async function initAuth(): Promise<boolean> {
  const stored = loadTokensFromDisk()
  if (!stored) return false

  accessToken = stored.accessToken
  refreshToken = stored.refreshToken
  expiresAt = stored.expiresAt

  // If token is expired or about to expire, try refreshing
  const now = Date.now()
  if (expiresAt && expiresAt - now < 60_000) {
    try {
      await refreshAccessToken()
      console.log('Auth session restored via token refresh')
      return true
    } catch (err) {
      console.error('Failed to restore auth session:', err)
      accessToken = null
      refreshToken = null
      expiresAt = null
      clearTokensFromDisk()
      return false
    }
  }

  // Token still valid — schedule refresh
  const remainingSeconds = Math.floor((expiresAt - now) / 1000)
  scheduleRefresh(remainingSeconds)
  console.log('Auth session restored from disk, expires in', remainingSeconds, 's')
  tokenChangedCallback?.(accessToken)
  return true
}

export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshToken) return null

  const tokenData = await postTokenEndpoint({
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    refresh_token: refreshToken,
  })
  setTokens(tokenData)
  return accessToken
}

export function login(): Promise<string> {
  return new Promise((resolve, reject) => {
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'openid profile email',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })

    const authWindow = new BrowserWindow({
      width: 600,
      height: 700,
      show: true,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    })

    const fullUrl = `${AUTH_URL}?${params.toString()}`
    authWindow.loadURL(fullUrl)

    let handled = false

    const handleRedirect = (url: string): void => {
      if (handled) return
      if (!url.startsWith(REDIRECT_URI)) return

      handled = true
      const redirectUrl = new URL(url)
      const code = redirectUrl.searchParams.get('code')
      const error = redirectUrl.searchParams.get('error')

      authWindow.close()

      if (error) {
        reject(new Error(`Auth error: ${error}`))
        return
      }

      if (!code) {
        reject(new Error('No authorization code received'))
        return
      }

      exchangeCode(code, codeVerifier)
        .then(() => resolve(accessToken!))
        .catch(reject)
    }

    authWindow.webContents.on('will-redirect', (_event, url) => {
      handleRedirect(url)
    })

    authWindow.webContents.on('will-navigate', (_event, url) => {
      handleRedirect(url)
    })

    authWindow.on('closed', () => {
      if (!handled) {
        reject(new Error('Auth window closed by user'))
      }
    })
  })
}

export function getToken(): string | null {
  return accessToken
}

export function getTokenClaims(): { name?: string; email?: string } | null {
  if (!accessToken) return null
  try {
    const payload = accessToken.split('.')[1]
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return { name: decoded.name || decoded.preferred_username, email: decoded.email }
  } catch {
    return null
  }
}

export function isAuthenticated(): boolean {
  return accessToken !== null && expiresAt !== null && expiresAt > Date.now()
}

export function logout(): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }

  // Best-effort Keycloak logout (fire-and-forget)
  if (refreshToken) {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      refresh_token: refreshToken,
    })
    const request = net.request({ method: 'POST', url: LOGOUT_URL })
    request.setHeader('Content-Type', 'application/x-www-form-urlencoded')
    request.on('error', () => {})
    request.write(params.toString())
    request.end()
  }

  accessToken = null
  refreshToken = null
  expiresAt = null
  clearTokensFromDisk()
  tokenChangedCallback?.(null)
}

export function setTokenChangedCallback(cb: (token: string | null) => void): void {
  tokenChangedCallback = cb
}
