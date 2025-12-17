# Project Structure

## Root Directory
```
├── index.html          # Main PWA application (single-page app)
├── manifest.json       # PWA manifest configuration
├── sw.js              # Service Worker for offline support
├── icon.svg           # Application icon
├── README.md          # Project documentation
└── worker/            # Cloudflare Workers backend
```

## Frontend Structure (Root)
- **index.html**: Complete single-page application with embedded CSS and JavaScript
- **manifest.json**: PWA configuration for installability
- **sw.js**: Service Worker for caching and offline functionality
- **icon.svg**: Scalable vector icon for PWA and branding

## Backend Structure (worker/)
```
worker/
├── src/
│   └── index.js           # Main Hono application with all API routes
├── public/                # Static assets served by Workers
│   ├── index.html         # Frontend application copy
│   ├── manifest.json      # PWA manifest copy
│   ├── sw.js             # Service Worker copy
│   ├── icon.svg          # Icon copy
│   ├── project.html      # Project management interface
│   ├── projects.html     # Projects listing page
│   └── rules.html        # Rules management interface
├── migrations/           # D1 database schema migrations
│   ├── 0001_initial_schema.sql
│   ├── 0002_output_requirements.sql
│   ├── 0003_prompt_linking.sql
│   ├── 0004_projects.sql
│   ├── 0005_prompt_project_linking.sql
│   └── 0006_rule_sets.sql
├── package.json         # Node.js dependencies and scripts
├── package-lock.json    # Dependency lock file
└── wrangler.toml       # Cloudflare Workers configuration
```

## Database Schema Organization
- **Core Tables**: agents, prompt_templates, output_requirements
- **Project Management**: project_plans, plan_steps, plan_step_prompts
- **Rules System**: ides, agent_rules, rule_sets
- **Analytics**: usage_history

## API Route Organization
All routes are defined in `worker/src/index.js`:
- `/api/agents/*` - Agent management
- `/api/templates/*` - Prompt templates
- `/api/output-requirements/*` - Output format requirements
- `/api/rules/*` - Agent rules and guidelines
- `/api/plans/*` - Project planning
- `/api/ides/*` - IDE configurations (read-only)
- `/api/ai/*` - AI enhancement endpoints
- `/api/export/*` - Export functionality

## Configuration Files
- **wrangler.toml**: Cloudflare Workers deployment configuration
- **package.json**: Dependencies (Hono, Wrangler)
- **manifest.json**: PWA installation and theming
- **.env**: Environment variables (not tracked in git)

## Development Workflow
1. Frontend changes: Edit root `index.html`, test with local server
2. Backend changes: Edit `worker/src/index.js`, test with `wrangler dev`
3. Database changes: Create new migration in `worker/migrations/`
4. Deployment: Use `wrangler deploy` from worker directory