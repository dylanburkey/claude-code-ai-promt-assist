# Development Guide

This guide covers development workflows, coding standards, and contribution guidelines for Semantic Prompt Workstation.

## Development Environment

### Prerequisites
- Node.js 18+ and npm
- Git
- Modern web browser
- Cloudflare account (for backend development)

### Setup
```bash
# Clone repository
git clone https://github.com/dylanburkey/claude-code-ai-promt-assist.git
cd claude-code-ai-promt-assist

# Backend setup
cd worker
npm install
npx wrangler login

# Start development
npm run dev
```

## Development Workflow

### Frontend Development
1. **Local Development**: Use any static server for the root directory
2. **Live Reload**: Manual refresh (no build system)
3. **Testing**: Browser developer tools and manual testing
4. **PWA Testing**: Use Chrome DevTools Application tab

### Backend Development
1. **Local API**: `wrangler dev` provides local D1 and Workers AI
2. **Database**: Use `--local` flag for local D1 instance
3. **Debugging**: `console.log` appears in wrangler dev output
4. **Testing**: Manual API testing with curl or Postman

### Full Stack Workflow
```bash
# Terminal 1: Backend
cd worker && npm run dev

# Terminal 2: Frontend (if needed)
python -m http.server 8000

# Terminal 3: Database operations
wrangler d1 execute prompt-workstation-db --local --command "SELECT * FROM agents"
```

## Project Structure

### Frontend Architecture
- **Single Page App**: All code in `index.html`
- **Vanilla JavaScript**: No framework dependencies
- **CSS Custom Properties**: For theming and responsive design
- **Service Worker**: Offline functionality in `sw.js`

### Backend Architecture
- **Hono Framework**: Lightweight web framework for Workers
- **Route Organization**: All routes in `worker/src/index.js`
- **Database Layer**: Direct D1 integration with prepared statements
- **AI Integration**: Cloudflare Workers AI for enhancement features

## Coding Standards

### JavaScript Style
```javascript
// Use modern ES6+ features
const fetchAgents = async () => {
  try {
    const response = await fetch('/api/agents');
    const { data } = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch agents:', error);
    throw error;
  }
};

// Use descriptive variable names
const isDefaultAgent = agent.is_default === 1;
const activeAgents = agents.filter(agent => agent.is_active);

// Prefer const/let over var
const API_BASE = '/api';
let currentAgent = null;
```

### CSS Organization
```css
/* Use CSS custom properties for theming */
:root {
  --primary-color: #2563eb;
  --background-color: #ffffff;
  --text-color: #1f2937;
}

/* Mobile-first responsive design */
.container {
  padding: 1rem;
}

@media (min-width: 768px) {
  .container {
    padding: 2rem;
  }
}

/* Use semantic class names */
.agent-card { /* not .blue-box */ }
.prompt-builder { /* not .form-container */ }
```

### API Design Patterns
```javascript
// Consistent response format
const successResponse = (data, message = null) => ({
  success: true,
  data,
  message,
  timestamp: new Date().toISOString()
});

const errorResponse = (code, message, details = null) => ({
  success: false,
  error: { code, message, details },
  timestamp: new Date().toISOString()
});

// Use proper HTTP status codes
app.get('/api/agents/:id', async (c) => {
  const agent = await getAgent(c.req.param('id'));
  if (!agent) {
    return c.json(errorResponse('AGENT_NOT_FOUND', 'Agent not found'), 404);
  }
  return c.json(successResponse(agent));
});
```

## Database Development

### Migration Workflow
```bash
# Create new migration
touch worker/migrations/0007_new_feature.sql

# Write migration SQL
echo "ALTER TABLE agents ADD COLUMN new_field TEXT;" > worker/migrations/0007_new_feature.sql

# Test locally
wrangler d1 migrations apply prompt-workstation-db --local

# Apply to production
wrangler d1 migrations apply prompt-workstation-db
```

### Query Patterns
```javascript
// Use prepared statements
const getAgentById = async (db, id) => {
  const stmt = db.prepare('SELECT * FROM agents WHERE id = ? AND is_active = 1');
  return await stmt.bind(id).first();
};

// Handle JSON fields properly
const updateAgentTags = async (db, id, tags) => {
  const stmt = db.prepare('UPDATE agents SET tags = ? WHERE id = ?');
  return await stmt.bind(JSON.stringify(tags), id).run();
};
```

## Testing Strategy

### Manual Testing Checklist
- [ ] PWA installation works
- [ ] Offline functionality
- [ ] Responsive design (mobile/desktop)
- [ ] All API endpoints respond correctly
- [ ] Database operations complete successfully
- [ ] AI enhancement features work (if configured)

### Browser Testing
- Chrome 80+ (primary)
- Firefox 75+
- Safari 13+
- Edge 80+

### API Testing
```bash
# Test agent creation
curl -X POST http://localhost:8787/api/agents \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Agent","role":"Test role"}'

# Test prompt enhancement
curl -X POST http://localhost:8787/api/ai/enhance-prompt \
  -H "Content-Type: application/json" \
  -d '{"text":"Help me code","agent_id":"agent_id"}'
```

## Performance Guidelines

### Frontend Optimization
- Minimize DOM manipulations
- Use event delegation for dynamic content
- Implement lazy loading for large lists
- Cache API responses in localStorage

### Backend Optimization
- Use database indexes effectively
- Implement pagination for large datasets
- Cache frequently accessed data
- Optimize JSON field queries

### PWA Performance
- Keep service worker cache size reasonable
- Use cache-first strategy for static assets
- Implement background sync for offline actions

## Debugging

### Frontend Debugging
```javascript
// Use console groups for organized logging
console.group('Agent Management');
console.log('Loading agents...');
console.table(agents);
console.groupEnd();

// Debug PWA issues
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', event => {
    console.log('SW message:', event.data);
  });
}
```

### Backend Debugging
```javascript
// Log request details
app.use('*', async (c, next) => {
  console.log(`${c.req.method} ${c.req.url}`);
  await next();
});

// Debug database queries
const result = await stmt.bind(id).first();
console.log('Query result:', result);
```

### Common Issues

**CORS Errors**: Ensure CORS middleware is properly configured
**Database Errors**: Check migration status and D1 binding
**PWA Issues**: Verify manifest.json and service worker registration
**AI Errors**: Confirm Workers AI binding and model availability

## Contributing

### Pull Request Process
1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-feature`
3. Make changes following coding standards
4. Test thoroughly (manual testing checklist)
5. Update documentation if needed
6. Submit pull request with clear description

### Commit Message Format
```
type(scope): description

feat(agents): add agent export functionality
fix(api): resolve CORS issue for OPTIONS requests
docs(readme): update installation instructions
refactor(db): optimize agent queries with indexes
```

### Code Review Guidelines
- Check for security vulnerabilities
- Verify responsive design works
- Test API changes manually
- Ensure documentation is updated
- Confirm PWA functionality intact

## Deployment

### Development Deployment
```bash
cd worker
npm run deploy
```

### Production Considerations
- Environment variables properly set
- Database migrations applied
- Custom domain configured (if applicable)
- Monitoring and logging enabled

## Documentation

### Updating Documentation
- Update relevant `/docs` files for API changes
- Include code examples for new features
- Update README.md for major changes
- Keep migration documentation current

### Documentation Standards
- Use clear, concise language
- Include practical examples
- Maintain consistent formatting
- Update table of contents when adding sections