# Deployment Guide

This guide covers deploying Semantic Prompt Workstation to production using Cloudflare Workers and D1 database.

## Deployment Overview

The application deploys as a Cloudflare Worker with:
- **Static Assets**: Served via Workers Assets
- **API**: Hono-based REST API
- **Database**: Cloudflare D1 (SQLite)
- **AI**: Cloudflare Workers AI (optional)

## Prerequisites

### Required Accounts
- [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier available)
- Domain name (optional, for custom domains)

### Required Tools
- Node.js 18+ and npm
- Wrangler CLI 3.0+
- Git

### Setup Wrangler
```bash
# Install Wrangler globally
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Verify authentication
wrangler whoami
```

## Initial Setup

### 1. Clone and Install
```bash
git clone https://github.com/dylanburkey/claude-code-ai-promt-assist.git
cd claude-code-ai-promt-assist/worker
npm install
```

### 2. Configure Cloudflare Account
```bash
# Get your account ID
wrangler whoami

# Update wrangler.toml with your account ID
```

Edit `worker/wrangler.toml`:
```toml
name = "semantic-prompt-workstation"
account_id = "YOUR_ACCOUNT_ID_HERE"  # Replace with your account ID
compatibility_date = "2024-12-01"
main = "./src/index.js"
```

### 3. Create D1 Database
```bash
# Create the database
wrangler d1 create prompt-workstation-db

# Copy the database ID from output and update wrangler.toml
```

Update the `[[d1_databases]]` section in `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "prompt-workstation-db"
database_id = "YOUR_DATABASE_ID_HERE"  # Replace with generated ID
```

### 4. Run Database Migrations
```bash
# Apply all migrations to production database
wrangler d1 migrations apply prompt-workstation-db

# Verify migrations
wrangler d1 migrations list prompt-workstation-db
```

## Deployment Process

### Deploy to Production
```bash
# Deploy the worker
npm run deploy

# Or with verbose output
wrangler deploy --verbose
```

### Verify Deployment
```bash
# Check deployment status
wrangler deployments list

# Test the API
curl https://your-worker.your-subdomain.workers.dev/api/agents

# View live logs
npm run tail
```

## Configuration Options

### Environment Variables
Create `.env` file in worker directory:
```env
# Optional: Custom configuration
ENVIRONMENT=production
DEBUG_MODE=false
```

### Workers AI (Optional)
To enable AI enhancement features, ensure Workers AI is enabled in your Cloudflare account:

```toml
# In wrangler.toml
[ai]
binding = "AI"
```

### Custom Domain (Optional)
```bash
# Add custom domain
wrangler custom-domains add your-domain.com

# Update DNS records as instructed
# Deploy with custom domain
wrangler deploy
```

## Production Monitoring

### Logging
```bash
# View real-time logs
wrangler tail

# View logs with filters
wrangler tail --format pretty --status error
```

### Analytics
- Access Cloudflare Dashboard
- Navigate to Workers & Pages > your-worker
- View analytics, metrics, and logs

### Health Checks
```bash
# Basic health check
curl https://your-worker.your-subdomain.workers.dev/api/agents

# Database health check
curl https://your-worker.your-subdomain.workers.dev/api/ides
```

## Scaling and Performance

### Cloudflare Workers Limits
- **Free Tier**: 100,000 requests/day
- **Paid Tier**: 10 million requests/month
- **CPU Time**: 10ms (free), 50ms (paid)
- **Memory**: 128MB

### D1 Database Limits
- **Free Tier**: 100,000 reads/day, 100,000 writes/day
- **Storage**: 5GB (free), 50GB (paid)
- **Databases**: 10 (free), 500 (paid)

### Performance Optimization
- Use database indexes effectively
- Implement caching strategies
- Optimize JSON field queries
- Monitor response times

## Backup and Recovery

### Database Backup
```bash
# Export database
wrangler d1 export prompt-workstation-db --output backup-$(date +%Y%m%d).sql

# Restore from backup
wrangler d1 execute prompt-workstation-db --file backup.sql
```

### Code Backup
- Repository is backed up on GitHub
- Cloudflare maintains deployment history
- Use git tags for release versions

## Security Considerations

### Access Control
- No authentication required (public API)
- Consider adding API keys for production use
- Use Cloudflare security features (rate limiting, etc.)

### Data Protection
- All data encrypted at rest (D1)
- TLS encryption in transit
- No sensitive data stored in database

### Security Headers
Automatically applied via Hono middleware:
```javascript
secureHeaders({
  xFrameOptions: "DENY",
  xContentTypeOptions: "nosniff",
  referrerPolicy: "strict-origin-when-cross-origin"
})
```

## Troubleshooting

### Common Deployment Issues

**Authentication Error**:
```bash
wrangler logout
wrangler login
```

**Database Migration Fails**:
```bash
# Check database status
wrangler d1 info prompt-workstation-db

# Force re-run migrations
wrangler d1 migrations apply prompt-workstation-db --force
```

**Worker Deploy Fails**:
```bash
# Check wrangler.toml syntax
wrangler validate

# Deploy with verbose logging
wrangler deploy --verbose
```

### Performance Issues
- Check Cloudflare Analytics for bottlenecks
- Monitor D1 query performance
- Use `wrangler tail` for real-time debugging

### Database Issues
```bash
# Check database size and usage
wrangler d1 info prompt-workstation-db

# Query database directly
wrangler d1 execute prompt-workstation-db --command "SELECT COUNT(*) FROM agents"
```

## Maintenance

### Regular Tasks
- Monitor usage against limits
- Review error logs weekly
- Update dependencies monthly
- Backup database regularly

### Updates and Migrations
```bash
# Update dependencies
npm update

# Create new migration
touch migrations/0007_new_feature.sql

# Test migration locally
wrangler d1 migrations apply prompt-workstation-db --local

# Deploy migration
wrangler d1 migrations apply prompt-workstation-db

# Deploy updated code
npm run deploy
```

### Monitoring Checklist
- [ ] API response times < 200ms
- [ ] Error rate < 1%
- [ ] Database queries optimized
- [ ] No rate limit violations
- [ ] SSL certificate valid
- [ ] Custom domain working (if configured)

## Cost Management

### Free Tier Limits
- Workers: 100,000 requests/day
- D1: 100,000 reads + 100,000 writes/day
- Workers AI: 10,000 requests/day

### Monitoring Usage
```bash
# Check current usage
wrangler metrics

# View detailed analytics in dashboard
```

### Cost Optimization
- Implement caching to reduce database queries
- Use efficient SQL queries with proper indexes
- Monitor and optimize AI API usage
- Consider pagination for large datasets

## Support and Resources

### Cloudflare Documentation
- [Workers Documentation](https://developers.cloudflare.com/workers/)
- [D1 Documentation](https://developers.cloudflare.com/d1/)
- [Workers AI Documentation](https://developers.cloudflare.com/workers-ai/)

### Community Resources
- [Cloudflare Discord](https://discord.cloudflare.com/)
- [Workers Community Forum](https://community.cloudflare.com/c/developers/workers/)
- [GitHub Issues](https://github.com/dylanburkey/claude-code-ai-promt-assist/issues)

### Getting Help
1. Check this documentation first
2. Search existing GitHub issues
3. Create new issue with detailed description
4. Include error logs and configuration details