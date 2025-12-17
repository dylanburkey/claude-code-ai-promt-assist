# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Semantic Prompt Workstation is a PWA for generating AI prompts. It combines agent personas with tasks, context, and formatting requirements to produce structured prompts for AI models like Claude.

**Stack:** Vanilla JavaScript frontend + Cloudflare Workers backend (Hono.js) + D1 SQLite database + Workers AI (Llama 3.1)

## Development Commands

```bash
# Start local development (serves at http://localhost:8787)
cd worker && npm run dev

# Deploy to production
cd worker && npm run deploy

# View live production logs
cd worker && npm run tail

# Database operations (local)
wrangler d1 migrations apply prompt-workstation-db --local
wrangler d1 execute prompt-workstation-db --local --command "SELECT * FROM agents"

# Database operations (production)
wrangler d1 migrations apply prompt-workstation-db
```

## Architecture

### Backend (`worker/`)
- **`src/index.js`** - Single Hono app with all API routes (~50+ endpoints)
- **Bindings** (from `wrangler.toml`):
  - `DB` - D1 SQLite database
  - `AI` - Workers AI (Llama 3.1 8B Instruct)
  - `ASSETS` - Static file serving from `public/`

### Frontend (`worker/public/`)
- Vanilla JavaScript with embedded CSS/JS in HTML files
- No build step - edit HTML files directly
- PWA with service worker (`sw.js`)

### Database
- SQLite via Cloudflare D1
- 8 migration files in `worker/migrations/`
- Key tables: `agents`, `projects`, `project_prompts`, `agent_rules`, `rule_sets`, `hooks`, `custom_agents`
- Triggers auto-update `updated_at` timestamps

## API Patterns

All API routes are in `worker/src/index.js`:
- `/api/agents/*` - Agent CRUD
- `/api/projects/*` - Project management with slug-based URLs
- `/api/rules/*` and `/api/rule-sets/*` - IDE configuration rules
- `/api/ai/*` - AI enhancement endpoints (enhance-prompt, suggest-improvements, analyze-prompt)
- `/api/hooks/*` - Claude Code lifecycle hooks
- `/api/export/*` - Export to Claude Code, markdown formats

## Clean URL Routes

Static routes use SPA fallback (configured in `wrangler.toml`):
- `/projects` → projects.html
- `/project/:slug` → project.html (fetches by slug)
- `/rules` → rules.html
- `/hooks` → hooks.html
- `/agents` → agents.html

## Key Conventions

- **CSS:** Never use `!important`
- **IDs:** Generated with `crypto.randomUUID().replace(/-/g, "")`
- **JSON fields:** Tags, placeholders, and rules stored as JSON strings in SQLite
- **CORS:** Enabled for all origins on `/api/*`
- **Error responses:** Return `{ error: "message" }` with appropriate status codes

## Database Migration Workflow

1. Create new migration: `worker/migrations/NNNN_description.sql`
2. Test locally: `wrangler d1 migrations apply prompt-workstation-db --local`
3. Deploy to production: `wrangler d1 migrations apply prompt-workstation-db`

## Supported IDEs (seeded in DB)

- Claude Code (`.claude/rules.md`)
- Cursor (`.cursorrules`)
- Windsurf (`.windsurfrules`)
- VS Code (`.vscode/settings.json`)
- Zed (`.zed/settings.json`)
