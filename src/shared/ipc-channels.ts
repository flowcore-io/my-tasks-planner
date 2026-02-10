export const IPC_CHANNELS = {
  // Tasks
  TASKS_LIST: 'tasks:list',
  TASKS_GET: 'tasks:get',
  TASKS_CREATE: 'tasks:create',
  TASKS_UPDATE: 'tasks:update',
  TASKS_DELETE: 'tasks:delete',
  TASKS_REORDER: 'tasks:reorder',
  TASKS_ADD_COMMENT: 'tasks:add-comment',
  // Dependencies
  DEPS_LIST: 'deps:list',
  DEPS_ADD: 'deps:add',
  DEPS_REMOVE: 'deps:remove',
  DEPS_GET_GRAPH: 'deps:get-graph',
  // Tags
  TAGS_LIST: 'tags:list',
  TAGS_CREATE: 'tags:create',
  TAGS_DELETE: 'tags:delete',
  TAGS_ASSIGN: 'tags:assign',
  TAGS_UNASSIGN: 'tags:unassign',
  // App
  APP_GET_THEME: 'app:get-theme',
  APP_SET_THEME: 'app:set-theme',
  // Auth
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_GET_TOKEN: 'auth:get-token',
  AUTH_ON_TOKEN_REFRESH: 'auth:on-token-refresh',
  AUTH_IS_AUTHENTICATED: 'auth:is-authenticated',
  AUTH_STATUS_CHANGED: 'auth:status-changed',
  // Usable workspace
  USABLE_LIST_WORKSPACES: 'usable:list-workspaces',
  USABLE_GET_FRAGMENT_TYPES: 'usable:get-fragment-types',
  USABLE_CONNECT_WORKSPACE: 'usable:connect-workspace',
  USABLE_GET_WORKSPACE: 'usable:get-workspace',
  USABLE_SET_WORKSPACE: 'usable:set-workspace',
  USABLE_CHECK_CONNECTION: 'usable:check-connection',
  USABLE_LIST_MEMBERS: 'usable:list-members',
  // Chat overlay
  CHAT_OPEN_APP: 'chat:open-app',
  CHAT_SET_IGNORE_MOUSE: 'chat:set-ignore-mouse',
  CHAT_GET_MODE: 'chat:get-mode',
  CHAT_SET_MODE: 'chat:set-mode',
  CHAT_MODE_CHANGED: 'chat:mode-changed',
  CHAT_INJECT_THEME_CSS: 'chat:inject-theme-css',
  // Cross-window sync
  TASKS_CHANGED: 'tasks:changed',
} as const
