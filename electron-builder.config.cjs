/**
 * electron-builder configuration.
 * productName and appId can be overridden via environment variables:
 * - APP_NAME: display name (e.g. "My Tasks Planner")
 * - APP_ID: macOS bundle id (e.g. "com.flowcore.my-tasks-plan")
 */
const appName = process.env.APP_NAME?.trim() || 'My Tasks Planner'
const appId = process.env.APP_ID?.trim() || 'com.flowcore.my-tasks-plan'

module.exports = {
  appId,
  productName: appName,
  directories: {
    buildResources: 'resources'
  },
  files: [
    '!**/.vscode/*',
    '!src/*',
    '!electron.vite.config.*',
    '!{.eslintignore,.eslintrc.cjs,.prettierignore,.prettierrc.yaml,dev-app-update.yml,CHANGELOG.md,README.md}',
    '!{tsconfig.json,tsconfig.node.json,tsconfig.web.json}'
  ],
  asarUnpack: ['node_modules/better-sqlite3/**'],
  mac: {
    icon: 'resources/icon.icns',
    entitlementsInherit: 'build/entitlements.mac.plist',
    extendInfo: [
      'NSDocumentsFolderUsageDescription: Application needs access for task data.'
    ],
    notarize: false,
    target: [
      {
        target: 'dmg',
        arch: ['arm64', 'x64']
      }
    ]
  },
  win: {
    icon: 'resources/icon.png',
    target: [
      {
        target: 'nsis',
        arch: ['x64']
      }
    ]
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    allowToChangeInstallationDirectory: false
  },
  npmRebuild: true,
  publish: {
    provider: 'generic',
    url: ''
  }
}
