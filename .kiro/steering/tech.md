# Technology Stack

## Frontend
- **Framework**: Vanilla JavaScript (no framework dependencies)
- **Styling**: CSS3 with custom properties and CSS Grid/Flexbox
- **PWA**: Service Worker for offline support, Web App Manifest
- **Storage**: Browser localStorage for client-side persistence
- **Fonts**: IBM Plex Sans, IBM Plex Mono, Space Grotesk

## Backend
- **Runtime**: Cloudflare Workers
- **Framework**: Hono.js for HTTP routing and middleware
- **Database**: Cloudflare D1 (SQLite-based)
- **AI**: Cloudflare Workers AI (Llama 3.1 8B Instruct model)
- **Assets**: Cloudflare Workers Assets for static file serving

## Development Tools
- **Package Manager**: npm
- **Deployment**: Wrangler CLI for Cloudflare Workers

## Common Commands

### Development
```bash
# Start local development server (worker)
cd worker && npm run dev

# Deploy to production
cd worker && npm run deploy

# View live logs
cd worker && npm run tail
```

### Frontend Development
```bash
# Serve frontend locally (any static server)
python -m http.server 8000
# or
npx serve
# or  
php -S localhost:8000
```

### Database Management
```bash
# Run migrations (via Wrangler)
wrangler d1 migrations apply prompt-workstation-db

# Query database locally
wrangler d1 execute prompt-workstation-db --local --command "SELECT * FROM agents"
```

## Architecture Patterns
- **API-First**: RESTful API endpoints with JSON responses
- **Progressive Enhancement**: Works offline, enhances with cloud features
- **Mobile-First**: Responsive design with mobile tabs and desktop grid
- **Component-Based**: Modular JavaScript with clear separation of concerns