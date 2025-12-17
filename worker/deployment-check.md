# Deployment Readiness Checklist

## Database Schema Changes ✅

### Migration 0009 - Complete Schema Rebuild
- **Action**: Drops and recreates tables with correct schema
- **Tables Affected**:
  - `export_history` - Recreated with project_id column
  - `project_resources` - Created with proper foreign keys
  - `resource_dependencies` - Created for dependency tracking

### Schema Compatibility
- ✅ `project_id` uses INTEGER to match projects table
- ✅ Foreign key constraints properly defined
- ✅ Indexes created for performance
- ✅ Triggers for timestamp updates

## Code Compatibility ✅

### Removed Incompatible References
- ✅ Removed `export_type` column references
- ✅ Updated table names to match new schema
- ✅ Fixed foreign key data types

### API Endpoints Verified
- ✅ Project CRUD operations
- ✅ Resource assignment endpoints
- ✅ Export functionality
- ✅ AI enhancement endpoints

## Deployment Steps

### 1. Database Migration
```bash
# Apply the migration to recreate tables
wrangler d1 migrations apply prompt-workstation-db --remote
```

### 2. Code Deployment
```bash
# Deploy the updated worker code
wrangler deploy
```

### 3. Verification
```bash
# Test basic functionality
curl https://your-worker.workers.dev/api/projects
```

## Breaking Changes Warning ⚠️

**This deployment will drop existing data in these tables:**
- `export_history` - All export history will be lost
- `project_resources` - All resource assignments will be lost (if any existed)
- `resource_dependencies` - All dependency data will be lost (if any existed)

**Data that will be preserved:**
- `projects` - All project data remains intact
- `agents` - All agent data remains intact
- `agent_rules` - All rules remain intact
- `prompt_templates` - All templates remain intact
- All other existing tables remain unchanged

## Post-Deployment Testing

### Critical Workflows to Test
1. **Project Creation**: Create a new project
2. **Resource Assignment**: Assign agents/rules to projects
3. **Export Generation**: Export a project to Claude Code format
4. **AI Enhancement**: Test AI-powered suggestions
5. **Import Functionality**: Test resource import workflows

### API Endpoints to Verify
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `POST /api/projects/:id/resources` - Assign resources
- `POST /api/export/claude-code/:id` - Export project
- `POST /api/ai/enhance-resource` - AI enhancement

## Rollback Plan

If issues occur after deployment:

1. **Immediate Rollback**:
   ```bash
   # Deploy previous version
   git checkout <previous-commit>
   wrangler deploy
   ```

2. **Database Rollback**:
   - The old export_history table structure cannot be automatically restored
   - Manual recreation would be needed if rollback is required
   - Consider backing up critical data before deployment

## Environment Variables

Ensure these are set in Cloudflare Workers:
- `DB` - D1 database binding
- `AI` - Workers AI binding (if using AI features)

## Performance Considerations

- New indexes will improve query performance
- Foreign key constraints may add slight overhead
- Export functionality now properly tracks project relationships

## Security Notes

- Foreign key constraints improve data integrity
- Proper cascade deletes prevent orphaned records
- Validation system ensures data quality

## Monitoring

After deployment, monitor:
- API response times
- Error rates in Cloudflare dashboard
- Database query performance
- Export generation success rates

---

**Ready for Deployment**: ✅ Yes, with data loss warning acknowledged