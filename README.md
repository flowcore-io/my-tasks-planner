# My Tasks Planner

A desktop task manager application built with Electron, React, and TypeScript.

## Features

- Task management with drag-and-drop support
- Rich text editing with TipTap
- Flow-based visualization with React Flow
- Smooth animations with Framer Motion
- Integrated AI chat via Usable Chat embed

## Tech Stack

- **Framework**: Electron + Vite
- **Frontend**: React 19, TypeScript
- **Styling**: Tailwind CSS 4
- **UI Components**: Lucide React icons
- **State Management**: TanStack Query
- **Drag & Drop**: @hello-pangea/dnd
- **Rich Text**: TipTap
- **Flow Diagrams**: React Flow + ELK.js

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- A Usable Chat embed token (see below)

### Installation

```bash
# Install dependencies
bun install

# Copy environment file and configure
cp .env.example .env
```

### Configuration

Edit the `.env` file with your Usable embed token:

```bash
VITE_USABLE_EMBED_TOKEN=your-embed-token-here
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

## Getting the Usable Embed Token

To get an embed token for the integrated AI chat:

1. **Create an Embed Configuration in Usable**
   - Navigate to [Usable Chat](https://chat.usable.ai) and log in
   - Go to the embed configuration interface
   - Create a new embed configuration with:
     - **Name**: A descriptive name (e.g., "My Tasks Planner Chat")
     - **Description**: Purpose of this embed
     - Configure UI settings, theme, and thinking mode as needed

2. **Generate an Embed Key**
   - Click the key icon on your embed config card
   - Click "+ Generate Key"
   - Fill in the required fields:
     - **Label**: Identifies this key (e.g., "Development", "Production")
     - **Allowed Sites**: Add the origins that can use this embed:
       - For development: `http://localhost:3000`
       - For Electron apps: `file://` or your app's protocol
     - **Expiration Date**: Optional - leave empty for no expiration
   - Click "Generate Key" to create the token

3. **Copy the Token**
   - After generation, copy the embed token (starts with `uc_`)
   - Add it to your `.env` file as `VITE_USABLE_EMBED_TOKEN`

### Multiple Environments

You can generate multiple keys for different environments:
- **Development**: `http://localhost:3000`, no expiration
- **Staging**: Your staging URL, no expiration
- **Production**: Your production URL, no expiration

## Creating a Custom Expert

To create a custom AI expert that powers the embedded chat:

### Via the Usable UI

1. **Navigate to Experts**
   - Go to [Usable Chat](https://chat.usable.ai) and log in
   - Navigate to `/settings/experts` or access from the settings menu

2. **Create a New Expert**
   - Click "Create Expert"
   - Fill in the basic information:
     - **Name**: A descriptive name (e.g., "Task Planning Assistant")
     - **Description**: What this expert specializes in
     - **Icon/Emoji**: Visual identifier (e.g., 📋)

3. **Configure the System Prompt**
   - Write a detailed system prompt that defines the expert's behavior
   - Example for a task planner:
     ```
     You are a Task Planning Assistant, specialized in helping users
     organize, prioritize, and manage their tasks effectively.
     
     Your expertise includes:
     - Breaking down complex projects into actionable tasks
     - Suggesting task priorities and deadlines
     - Providing productivity tips and best practices
     - Helping users stay organized and focused
     
     Be helpful, encouraging, and practical in your advice.
     ```

4. **Enable Tools**
   - Select which tools the expert can use:
     - `agentic-search-fragments` - Search knowledge base semantically
     - `get-memory-fragment-content` - Read full fragment content
     - `list-memory-fragments` - List and filter fragments
     - `exa-search` - Web search capabilities
     - `exa-get-contents` - Extract content from URLs
   - Lock tools if users shouldn't be able to disable them

5. **Configure Model Settings**
   - **Default Model**: Choose the AI model (e.g., `claude-sonnet-4`)
   - **Thinking Mode**: Standard, Quick Thinking, or Deep Thinking
   - **Temperature**: Control response creativity (0.0-1.0)

6. **Save the Expert**
   - Click "Create" to save your expert
   - Note the expert ID for use in embed configuration

### Link Expert to Embed Configuration

1. **Edit your Embed Configuration**
   - Go to `/settings/embeds`
   - Click on your embed configuration

2. **Set as Main Agent**
   - In the "Main Agent" section, select your custom expert
   - Choose the mode:
     - **Prepend**: Expert's prompt is added before the default system prompt
     - **Replace**: Expert's prompt completely replaces the default

3. **Configure Expert Visibility**
   - Enable/disable which experts are available
   - Lock experts so users can't disable them

4. **Save and Test**
   - Save the configuration
   - Test the embed to verify the expert is working correctly

### Example Expert Configuration

Here's an example configuration for a Task Planning expert:

```json
{
  "name": "Task Planning Assistant",
  "description": "Helps users organize and manage tasks effectively",
  "expertConfig": {
    "systemPrompt": "You are a Task Planning Assistant...",
    "enabledTools": [
      "agentic-search-fragments",
      "get-memory-fragment-content"
    ],
    "modelPreference": "quick-thinking",
    "uiColor": "blue-500",
    "uiEmoji": "📋"
  }
}
```

### Available Tools Reference

| Tool | Description |
|------|-------------|
| `agentic-search-fragments` | Semantic search across knowledge fragments |
| `get-memory-fragment-content` | Retrieve full content of a specific fragment |
| `list-memory-fragments` | List fragments with SQL-like filtering |
| `exa-search` | Search the web for information |
| `exa-get-contents` | Extract and read content from URLs |

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
