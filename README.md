# Semantic Prompt Workstation

A lightweight Progressive Web App (PWA) for generating semantic, well-structured prompts for AI models. Create custom agent personas and combine them with tasks, context, and formatting requirements to produce contextually-rich prompts.

## Features

- **Agent Management** - Create, edit, and delete AI agent personas with custom roles and output styles
- **Prompt Builder** - Interactive form to specify tasks, context, constraints, and output formats
- **Semantic Generation** - Combines agent persona + task + context + format into structured prompts
- **Import/Export** - Save and load agent configurations as JSON files
- **PWA Support** - Full offline functionality with service worker caching
- **Responsive Design** - Mobile-first layout with adaptive UI (3-column desktop, tabbed mobile)
- **Local Storage** - All data persists in browser localStorage

## Tech Stack

- Vanilla JavaScript (no framework dependencies)
- CSS3 with custom properties
- Service Worker for offline support
- Browser localStorage for persistence

## Getting Started

### Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/dylanburkey/claude-code-ai-promt-assist.git
   cd claude-code-ai-promt-assist
   ```

2. Serve the files locally. Any static server works:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx serve
   
   # Using PHP
   php -S localhost:8000
   ```

3. Open `http://localhost:8000` in your browser

### Install as PWA

Click the install button in your browser's address bar to add the app to your home screen for offline access.

## Usage

### Creating an Agent

1. Click the **+** button in the Agent Library sidebar
2. Fill in the agent details:
   - **Name**: Display name (e.g., "Senior Python Dev")
   - **Role**: Persona description defining expertise and behavior
   - **Style**: Output style preferences
3. Click **Save**

### Building a Prompt

1. Select an agent from the library
2. Fill in the Prompt Builder fields:
   - **Task**: What you want the AI to accomplish
   - **Context & Constraints**: Background information and limitations
   - **Output Format**: How you want the response structured
3. Click **Generate Prompt**
4. Copy the generated prompt from the output panel

### Importing/Exporting Agents

- **Export**: Click the export button to download your agents as a JSON file
- **Import**: Click the import button to load agents from a JSON file

## Project Structure

```
├── index.html      # Main application (HTML, CSS, JavaScript)
├── manifest.json   # PWA manifest configuration
├── sw.js           # Service Worker for offline support
├── icon.svg        # Application icon
└── README.md       # This file
```

## Browser Support

Works in all modern browsers that support:
- ES6+ JavaScript
- CSS Custom Properties
- Service Workers
- localStorage

## License

MIT License - feel free to use and modify as needed.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
