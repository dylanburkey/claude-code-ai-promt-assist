# Setup Guide

This guide covers installation and configuration for Semantic Prompt Workstation in different environments.

## Quick Start Options

### 1. Frontend Only (Local Development)
Perfect for trying out the app or frontend-only development:

```bash
git clone https://github.com/dylanburkey/claude-code-ai-promt-assist.git
cd claude-code-ai-promt-assist
python -m http.server 8000
```

Open `http://localhost:8000` in your browser.

### 2. Full Stack Development
For backend development and testing cloud features:

```bash
cd worker
npm install
npm run dev
```

### 3. Production Deployment
Deploy to Cloudflare Workers:

```bash
cd worker
npm run deploy
```

## Detailed Setup Instructions

- [Installation](installation.md) - Complete installation guide
- [Configuration](configuration.md) - Environment and service configuration
- [Development Environment](development-setup.md) - Setting up for development
- [PWA Installation](pwa-setup.md) - Installing as a Progressive Web App

## Prerequisites

### For Frontend Development
- Modern web browser with ES6+ support
- Static file server (Python, Node.js, PHP, etc.)

### For Backend Development
- Node.js 18+ and npm
- Cloudflare account
- Wrangler CLI

### For Production Deployment
- Cloudflare Workers account
- D1 database configured
- Workers AI enabled (optional)

## Environment Variables

Create a `.env` file in the worker directory:

```env
# Cloudflare Account ID
CLOUDFLARE_ACCOUNT_ID=your_account_id

# D1 Database ID
DATABASE_ID=your_database_id

# Optional: Custom domain
CUSTOM_DOMAIN=your-domain.com
```

## Next Steps

After setup, see:
- [Development Workflow](../development/workflow.md)
- [API Documentation](../api/README.md)
- [Database Setup](../database/setup.md)