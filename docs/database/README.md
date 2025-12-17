# Database Documentation

The Semantic Prompt Workstation uses Cloudflare D1, a SQLite-based database service, for data persistence.

## Overview

- **Database Engine**: SQLite (via Cloudflare D1)
- **Migration System**: SQL files in `worker/migrations/`
- **Schema Version**: Tracked automatically by D1
- **Backup**: Automatic via Cloudflare D1

## Documentation Structure

- [Database Schema](schema.md) - Complete table structure and relationships
- [Migrations](migrations.md) - Migration system and history
- [Setup Guide](setup.md) - Database configuration and initialization
- [Queries](queries.md) - Common query patterns and examples

## Quick Reference

### Core Tables

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `agents` | AI agent personas | → `agent_rules`, `project_agents` |
| `prompt_templates` | Reusable prompt structures | → `usage_history` |
| `projects` | Project containers | → `project_plans_link`, `project_agents` |
| `project_plans` | Project planning | → `plan_steps` |
| `plan_steps` | Individual project steps | → `plan_step_prompts` |
| `agent_rules` | IDE-specific rules | → `ides`, `agents` |
| `rule_sets` | Grouped rule collections | → `projects` |
| `ides` | Supported IDE configurations | → `agent_rules`, `rule_sets` |

### Database Statistics

Current schema includes:
- **8 core tables** for data storage
- **5 junction tables** for relationships
- **12 indexes** for query optimization
- **6 triggers** for automatic timestamp updates

## Connection Information

### Development (Local)
```bash
# Access local D1 database
wrangler d1 execute prompt-workstation-db --local --command "SELECT name FROM sqlite_master WHERE type='table'"
```

### Production
```bash
# Access production D1 database
wrangler d1 execute prompt-workstation-db --command "SELECT COUNT(*) FROM agents"
```

## Schema Evolution

The database schema evolves through numbered migration files:

1. `0001_initial_schema.sql` - Core tables and relationships
2. `0002_output_requirements.sql` - Output format specifications
3. `0003_prompt_linking.sql` - Prompt template relationships
4. `0004_projects.sql` - Project management system
5. `0005_prompt_project_linking.sql` - Project-prompt relationships
6. `0006_rule_sets.sql` - Rule set collections
7. `0007_rule_set_projects.sql` - Rule set project associations
8. `0008_hooks_and_agents.sql` - Hook and agent system enhancements
9. `0009_project_resources_export.sql` - Project resource management and export tracking

## Data Model Highlights

### Agent System
- Flexible agent personas with roles and styles
- Support for default agents and soft deletion
- Integration with rules and project assignments

### Project Management
- Hierarchical project structure with plans and steps
- SEO-friendly URLs with slug-based routing
- Project relationships and dependencies
- Cross-project AI context awareness

### Rule System
- IDE-specific rule configurations
- Agent-specific guidelines
- Grouped rule sets for export
- Priority-based rule ordering

### AI Integration
- Usage tracking for analytics
- Prompt template system with placeholders
- AI context summaries for projects
- Enhancement history tracking

## Performance Considerations

### Indexing Strategy
- Primary keys on all tables
- Composite indexes for common query patterns
- Foreign key indexes for join performance
- Timestamp indexes for chronological queries

### Query Optimization
- Use prepared statements via Hono/D1 integration
- Limit result sets with pagination
- Index-aware query design
- Efficient JSON field handling

### Scaling Limits
- D1 free tier: 100k requests/day
- Database size: 500MB on free tier
- Concurrent connections: Handled by Cloudflare
- Read replicas: Available in paid tiers

## Backup and Recovery

### Automatic Backups
- Cloudflare D1 provides automatic backups
- Point-in-time recovery available
- Cross-region replication on paid tiers

### Manual Backup
```bash
# Export database to SQL
wrangler d1 export prompt-workstation-db --output backup.sql

# Import from SQL
wrangler d1 execute prompt-workstation-db --file backup.sql
```

## Security

### Access Control
- Database access via Cloudflare Workers only
- No direct external database connections
- API-level access control and validation

### Data Protection
- Automatic encryption at rest
- TLS encryption in transit
- Cloudflare security infrastructure

## Monitoring

### Available Metrics
- Query performance via Wrangler logs
- Request volume in Cloudflare dashboard
- Error rates and response times
- Database size and usage statistics

### Logging
```bash
# View real-time logs
wrangler tail

# View D1-specific logs
wrangler d1 insights prompt-workstation-db
```

## Common Operations

### Development Workflow
```bash
# Create new migration
touch worker/migrations/0007_new_feature.sql

# Apply migrations locally
wrangler d1 migrations apply prompt-workstation-db --local

# Apply to production
wrangler d1 migrations apply prompt-workstation-db
```

### Data Management
```bash
# Query agents
wrangler d1 execute prompt-workstation-db --command "SELECT * FROM agents LIMIT 10"

# Reset local database
wrangler d1 migrations apply prompt-workstation-db --local --force

# Check migration status
wrangler d1 migrations list prompt-workstation-db
```