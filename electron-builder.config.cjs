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
  mac: {
    icon: 'resources/icon.icns',
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
  linux: {
    icon: 'resources/icon.png',
    target: [
      { target: 'AppImage', arch: ['x64'] },
      { target: 'deb', arch: ['x64'] }
    ]
  },
  win: {
    icon: 'resources/icon.png',
    target: [
      { target: 'nsis', arch: ['x64'] }
    ]
  },
  nsis: {
    oneClick: true
  },
  npmRebuild: true,
  publish: {
    provider: 'github'
  }
}
