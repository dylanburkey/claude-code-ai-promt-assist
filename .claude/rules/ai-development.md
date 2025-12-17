# AI Development Rules
# Comprehensive development guidelines for the Semantic Prompt Workstation project

## Technology Stack Compliance

# [HIGH] Follow the established technology stack
Use Vanilla JavaScript for frontend, Hono.js for Cloudflare Workers backend, and Cloudflare D1 for database operations. Avoid introducing framework dependencies that conflict with the PWA architecture.

# [HIGH] Maintain PWA compatibility
Ensure all frontend code works offline through service worker caching. Use progressive enhancement patterns and avoid dependencies on external CDNs for core functionality.

# [HIGH] Use consistent JavaScript coding standards
Use camelCase for variables and functions, PascalCase for constructors/classes. Follow modern ES6+ syntax with const/let instead of var, arrow functions where appropriate, and template literals for string interpolation.

# [HIGH] Implement proper error handling for Cloudflare Workers
Use try-catch blocks around database operations and AI API calls. Return proper HTTP status codes and structured error responses. Handle D1 database connection failures gracefully.

# [HIGH] Follow database schema migration best practices
Create incremental migrations in the `worker/migrations/` directory. Test migrations locally before deploying. Handle existing data conflicts when modifying table structures.

# [HIGH] Validate API inputs and outputs
Sanitize all user inputs before database operations. Use proper SQL parameter binding to prevent injection attacks. Validate JSON payloads and return consistent API response formats.

# [HIGH] Optimize for Cloudflare Workers constraints
Keep bundle sizes minimal, avoid Node.js-specific APIs, and use Web APIs instead. Implement efficient database queries to stay within D1 limits. Cache frequently accessed data appropriately.

## Development Workflow

# [HIGH] Test database changes locally before deployment
Use `wrangler d1 execute` for local testing and `wrangler d1 migrations apply` for deployment. Verify schema changes don't break existing functionality.

# [HIGH] Use proper deployment procedures
Deploy backend changes through `wrangler deploy` from the worker directory. Update frontend assets in `worker/public/` to maintain consistency. Test all API endpoints after deployment.

# [MEDIUM] Maintain code documentation
Document API endpoints with clear parameter descriptions and response formats. Use JSDoc comments for complex functions. Keep README files updated with current setup instructions.

# [MEDIUM] Implement comprehensive testing
Create integration tests for API endpoints, database operations, and AI enhancement features. Test PWA functionality including offline mode and service worker behavior.

# [MEDIUM] Follow semantic versioning for releases
Tag releases with semantic version numbers. Document breaking changes and migration steps. Maintain backward compatibility when possible.

# [MEDIUM] Monitor performance and usage
Track API response times, database query performance, and Cloudflare Workers metrics. Optimize slow queries and implement caching where beneficial.

## AI Integration Guidelines

# [HIGH] Use Cloudflare Workers AI responsibly
Implement proper rate limiting and error handling for AI API calls. Cache AI responses when appropriate to reduce costs and improve performance.

# [HIGH] Validate AI-generated content
Sanitize and validate all AI-generated prompts and content before storing or displaying. Implement content filtering for inappropriate or harmful outputs.

# [MEDIUM] Optimize AI prompt engineering
Use structured prompts with clear instructions and examples. Implement prompt templates for consistent AI interactions. Test prompt variations for optimal results.

# [MEDIUM] Handle AI service failures gracefully
Provide fallback behavior when AI services are unavailable. Display helpful error messages to users. Implement retry logic with exponential backoff.