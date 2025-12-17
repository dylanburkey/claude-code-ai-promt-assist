# Semantic Prompt Workstation Documentation

Welcome to the comprehensive documentation for Semantic Prompt Workstation, a Progressive Web App for generating semantic, well-structured prompts for AI models.

## Documentation Structure

### 📚 [Setup Guide](setup/)
Complete installation and configuration instructions for both development and production environments.

### 🔌 [API Documentation](api/)
Detailed API reference covering all endpoints, request/response formats, and authentication.

### 💻 [Development Guide](development/)
Development workflows, coding standards, and contribution guidelines.

### 🗄️ [Database Documentation](database/)
Database schema, migrations, and data model relationships.

### 🚀 [Deployment Guide](deployment/)
Production deployment instructions for Cloudflare Workers and D1 database.

### ✨ [Features Documentation](features/)
Detailed documentation for current and planned features, including the upcoming theme management system.

## Quick Links

- [Getting Started](setup/installation.md)
- [API Reference](api/README.md)
- [Database Schema](database/schema.md)
- [Development Workflow](development/workflow.md)
- [Deployment Instructions](deployment/cloudflare-workers.md)

## Project Overview

**Semantic Prompt Workstation** combines agent personas with tasks, context, and formatting requirements to produce contextually-rich prompts for AI models. It features a vanilla JavaScript PWA frontend with a Cloudflare Workers backend powered by D1 database and Workers AI.

### Key Features

- **Claude Code Project Bootstrap** - Complete project management and export system for ready-to-use Claude Code structures
- **AI-Enhanced Resource Creation** - Contextual suggestions for agents, rules, and hooks using Cloudflare Workers AI
- **Agent Management** - Custom AI personas with roles and output styles
- **Interactive Prompt Builder** - Form-based prompt construction with project context awareness
- **Project Organization** - Visual project management with resource assignment and dependency tracking
- **Complete Export System** - Generate full Claude Code project structures with CLAUDE.md and configuration files
- **Rule Sets** - IDE-specific configuration file generation
- **AI Enhancement** - Cloudflare Workers AI prompt optimization
- **PWA Support** - Full offline functionality with service worker
- **Theme Management** *(Planned)* - Customizable color palettes and typography

### Architecture

- **Frontend**: Vanilla JavaScript PWA
- **Backend**: Cloudflare Workers with Hono framework
- **Database**: Cloudflare D1 (SQLite)
- **AI**: Cloudflare Workers AI integration
- **Deployment**: Cloudflare Workers platform

## Support

For issues, questions, or contributions, please refer to the relevant documentation sections or create an issue in the project repository.