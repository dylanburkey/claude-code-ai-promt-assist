# Installation Guide

## System Requirements

### Minimum Requirements
- Modern web browser (Chrome 80+, Firefox 75+, Safari 13+, Edge 80+)
- Internet connection (for initial setup and cloud features)

### Development Requirements
- Node.js 18.0.0 or higher
- npm 8.0.0 or higher
- Git

### Production Requirements
- Cloudflare account
- Wrangler CLI 3.0+

## Installation Methods

### Method 1: Frontend Only (Quickest)

For trying out the app or frontend-only development:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/dylanburkey/claude-code-ai-promt-assist.git
   cd claude-code-ai-promt-assist
   ```

2. **Start a local server:**
   ```bash
   # Using Python 3
   python -m http.server 8000
   
   # Using Node.js
   npx serve
   
   # Using PHP
   php -S localhost:8000
   ```

3. **Open in browser:**
   Navigate to `http://localhost:8000`

### Method 2: Full Stack Development

For complete development environment with backend:

1. **Clone and setup:**
   ```bash
   git clone https://github.com/dylanburkey/claude-code-ai-promt-assist.git
   cd claude-code-ai-promt-assist/worker
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Wrangler:**
   ```bash
   npx wrangler login
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

### Method 3: Production Deployment

1. **Complete Method 2 setup first**

2. **Configure production environment:**
   ```bash
   # Create D1 database
   npx wrangler d1 create prompt-workstation-db
   
   # Update wrangler.toml with database ID
   # Run migrations
   npx wrangler d1 migrations apply prompt-workstation-db
   ```

3. **Deploy:**
   ```bash
   npm run deploy
   ```

## Verification

### Frontend Verification
- App loads without errors
- PWA install prompt appears
- Local storage works (create an agent)

### Backend Verification
- API endpoints respond (check `/api/agents`)
- Database operations work
- AI enhancement available (if configured)

### Production Verification
- Custom domain resolves (if configured)
- HTTPS certificate valid
- All features work in production

## Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Use different port
python -m http.server 8080
```

**Wrangler authentication issues:**
```bash
npx wrangler logout
npx wrangler login
```

**Database migration errors:**
```bash
# Check database status
npx wrangler d1 info prompt-workstation-db

# Re-run migrations
npx wrangler d1 migrations apply prompt-workstation-db --force
```

### Browser Compatibility

| Browser | Minimum Version | Notes |
|---------|----------------|-------|
| Chrome | 80+ | Full support |
| Firefox | 75+ | Full support |
| Safari | 13+ | Full support |
| Edge | 80+ | Full support |

### Performance Considerations

- **Local Development**: Any modern computer
- **Production**: Cloudflare Workers (serverless, auto-scaling)
- **Database**: D1 handles up to 100k requests/day on free tier

## Next Steps

After successful installation:

1. [Configure your environment](configuration.md)
2. [Set up development workflow](../development/workflow.md)
3. [Explore the API](../api/README.md)
4. [Install as PWA](pwa-setup.md)