# My Tasks Planner

A desktop task manager application built with Electron, React, and TypeScript, with integrated AI chat powered by [Usable](https://usable.ai).

## Features

- Task management with drag-and-drop Kanban board
- Timeline (Gantt) view with drag-to-resize scheduling
- Dependency graph visualization with React Flow
- Task assignees with workspace member support
- Integrated AI chat via Usable Chat embed
- Dark/light theme support

## Tech Stack

- **Framework**: Electron + Vite
- **Frontend**: React 19, TypeScript
- **Styling**: Tailwind CSS 4
- **UI Components**: Lucide React icons
- **State Management**: TanStack Query
- **Drag & Drop**: @hello-pangea/dnd
- **Flow Diagrams**: React Flow + ELK.js

## Getting Started

### Prerequisites

- Node.js 18+ or Bun

### Installation

```bash
# Install dependencies
bun install
```

### Development

```bash
# Start development server
bun run dev
```

### Build

```bash
# Build for production
bun run build

# Preview production build
bun run preview
```

### Package as Executable

```bash
# Build and package for your platform
bun run dist --mac      # macOS (.dmg)
bun run dist --win      # Windows (.exe)
bun run dist --linux    # Linux (.AppImage, .deb)
```

The packaged application will be output to the `dist/` directory.

## Configuration

On first launch, log in and select a Usable workspace in the Settings modal. The AI chat embed is preconfigured and works out of the box.

### Environment variables

| Variable | Type | Description | Default | Required |
|----------|------|-------------|---------|----------|
| APP_NAME | string | Application display name (window title, sidebar, tray tooltip) | "My Tasks Planner" | |
| APP_ID | string | macOS bundle identifier (used when packaging with `bun run dist`) | "com.flowcore.my-tasks-plan" | |

### Advanced Overrides

If you need to point the chat embed to a different URL or use a different embed token (e.g., for local development), open **Settings > Advanced** and override:

- **Chat Embed URL** - defaults to `https://chat.usable.dev`
- **Embed Token** - defaults to the built-in public token

These overrides are stored in localStorage and persist across sessions.

## Creating a Custom Expert

To create a custom AI expert that powers the embedded chat:

### Via the Usable UI

1. **Navigate to Experts**
   - Go to [Usable Chat](https://chat.usable.dev) and log in
   - Navigate to `/settings/experts` or access from the settings menu

2. **Create a New Expert**
   - Click "Create Expert"
   - Fill in the basic information:
     - **Name**: A descriptive name (e.g., "Task Planning Assistant")
     - **Description**: What this expert specializes in
     - **Icon/Emoji**: Visual identifier (e.g., 📋)

3. **Configure the System Prompt**
   - Write a detailed system prompt that defines the expert's behavior

4. **Enable Tools**
   - Select which built-in tools the expert can use:
     - `agentic-search-fragments` - Search knowledge base semantically
     - `get-memory-fragment-content` - Read full fragment content
     - `list-memory-fragments` - List and filter fragments
     - `exa-search` - Web search capabilities
     - `exa-get-contents` - Extract content from URLs
   - Lock tools if users shouldn't be able to disable them

5. **Add Parent Tools (Required)**
   - Parent tools allow the AI to interact with this application
   - In the expert settings, add the following parent tools (name only, schema is provided by the app at runtime):
     - `list_tasks` - List all tasks with optional filtering
     - `get_task` - Get a single task by ID
     - `create_task` - Create a new task
     - `update_task` - Update an existing task
     - `delete_task` - Archive a task
     - `add_dependency` - Add a dependency between tasks
     - `remove_dependency` - Remove a dependency
     - `get_task_graph` - Get the full task dependency graph
     - `add_comment` - Add a comment to a task
   - `list_comments` - List comments on a task
   - `list_members` - List workspace members
   - `import_jira_task` - Import a JIRA issue by key (e.g. PROJ-123) into the planner; requires JIRA to be configured

6. **Link Expert to Embed Configuration**
   - Go to `/settings/embeds`
   - Edit your embed configuration
   - Set your custom expert as the "Main Agent"

### Available Tools Reference

| Tool | Description |
|------|-------------|
| `agentic-search-fragments` | Semantic search across knowledge fragments |
| `get-memory-fragment-content` | Retrieve full content of a specific fragment |
| `list-memory-fragments` | List fragments with SQL-like filtering |
| `exa-search` | Search the web for information |
| `exa-get-contents` | Extract and read content from URLs |

## JIRA integration

You can import JIRA Cloud issues into the planner and have status changes sync back to JIRA.

1. **Configure JIRA** (required once): Open **Settings**, expand **JIRA integration**, and enter your JIRA Cloud domain (e.g. `mycompany` for `https://mycompany.atlassian.net`), Atlassian account email, and [API token](https://id.atlassian.com/manage-profile/security/api-tokens). Click **Save**.

2. **Import in chat**: In the AI chat, say e.g. “Import PROJ-123” or “Add MY-456 from JIRA.” The `import_jira_task` tool will fetch the issue and create a linked task. If the issue was already imported, the existing task is returned.

3. **Status sync**: When you move a linked task to another column (e.g. To Do → In progress → Done), the app will try to transition the linked JIRA issue to a matching status. Sync is best-effort and does not block the UI.

See [docs/jira-integration.md](docs/jira-integration.md) for implementation details, status mapping, and API usage.

## Project Structure

```
src/
├── main/        # Electron main process
├── preload/     # Electron preload scripts
├── renderer/    # React frontend
└── shared/      # Shared utilities
```

## License

MIT
