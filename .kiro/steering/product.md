# Product Overview

**Semantic Prompt Workstation** is a Progressive Web App (PWA) for generating semantic, well-structured prompts for AI models. It combines agent personas with tasks, context, and formatting requirements to produce contextually-rich prompts.

## Core Features

- **Agent Management**: Create and manage AI agent personas with custom roles and output styles
- **Prompt Builder**: Interactive form for specifying tasks, context, constraints, and output formats  
- **Semantic Generation**: Combines agent persona + task + context + format into structured prompts
- **Theme Management**: Customizable color palettes and font combinations with live preview
- **Claude Code Export**: Optimized XML-structured prompts for Claude Code IDE integration
- **PWA Support**: Full offline functionality with service worker caching
- **Cloud Backend**: Cloudflare Workers with D1 database for data persistence and AI enhancement

## Target Use Cases

- Developers creating consistent prompts for AI coding assistants
- Teams standardizing AI interaction patterns
- Project managers structuring complex AI-assisted workflows
- Content creators building reusable prompt templates

## Architecture

- **Frontend**: Vanilla JavaScript PWA with responsive design
- **Backend**: Cloudflare Workers with Hono framework
- **Database**: Cloudflare D1 (SQLite) for structured data storage
- **AI Integration**: Cloudflare Workers AI for prompt enhancement and analysis