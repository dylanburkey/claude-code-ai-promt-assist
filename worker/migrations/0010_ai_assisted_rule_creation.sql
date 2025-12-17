-- Migration: 0010_ai_assisted_rule_creation.sql
-- Description: Add AI-assisted rule creation features including platform templates, usage tracking, and enhancement history
-- Requirements: 1.1, 2.1, 6.1

-- ============================================
-- PLATFORM TEMPLATES TABLE
-- Store rule templates organized by platform/technology
-- ============================================
CREATE TABLE IF NOT EXISTS platform_templates (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    description TEXT,
    platform TEXT NOT NULL, -- 'shopify', 'stripe', 'nextjs', 'general', etc.
    category TEXT NOT NULL, -- 'security', 'performance', 'best-practices', 'integration'
    template_content TEXT NOT NULL,
    keywords TEXT DEFAULT '[]', -- JSON array for platform detection
    usage_count INTEGER DEFAULT 0,
    success_rate REAL DEFAULT 0.0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for efficient template lookup
CREATE INDEX IF NOT EXISTS idx_platform_templates_platform ON platform_templates(platform, is_active);
CREATE INDEX IF NOT EXISTS idx_platform_templates_category ON platform_templates(category, is_active);
CREATE INDEX IF NOT EXISTS idx_platform_templates_usage ON platform_templates(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_platform_templates_success ON platform_templates(success_rate DESC);
CREATE INDEX IF NOT EXISTS idx_platform_templates_updated ON platform_templates(updated_at);

-- ============================================
-- AI USAGE TRACKING TABLE
-- Monitor AI service usage for cost control and rate limiting
-- ============================================
CREATE TABLE IF NOT EXISTS ai_usage_tracking (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT, -- For future user system
    request_type TEXT NOT NULL, -- 'enhance_rule', 'suggest_template', 'detect_platform', 'generate_content'
    project_id INTEGER,
    token_count INTEGER DEFAULT 0,
    processing_time_ms INTEGER,
    success INTEGER DEFAULT 1,
    error_message TEXT,
    request_context TEXT, -- JSON with additional context
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

-- Indexes for usage monitoring and analytics
CREATE INDEX IF NOT EXISTS idx_ai_usage_type ON ai_usage_tracking(request_type, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_project ON ai_usage_tracking(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_success ON ai_usage_tracking(success, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_date ON ai_usage_tracking(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON ai_usage_tracking(user_id, created_at);

-- ============================================
-- RULE ENHANCEMENT HISTORY TABLE
-- Track AI enhancement workflows and user feedback
-- ============================================
CREATE TABLE IF NOT EXISTS rule_enhancement_history (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    rule_id TEXT NOT NULL,
    original_content TEXT NOT NULL,
    enhanced_content TEXT NOT NULL,
    enhancement_type TEXT NOT NULL, -- 'ai_suggestion', 'template_applied', 'platform_detected'
    confidence_score REAL DEFAULT 0.0,
    user_accepted INTEGER, -- 1 = accepted, 0 = rejected, NULL = pending
    feedback TEXT,
    enhancement_metadata TEXT, -- JSON with additional enhancement details
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (rule_id) REFERENCES agent_rules(id) ON DELETE CASCADE
);

-- Indexes for enhancement history tracking
CREATE INDEX IF NOT EXISTS idx_enhancement_history_rule ON rule_enhancement_history(rule_id, created_at);
CREATE INDEX IF NOT EXISTS idx_enhancement_history_type ON rule_enhancement_history(enhancement_type, created_at);
CREATE INDEX IF NOT EXISTS idx_enhancement_history_accepted ON rule_enhancement_history(user_accepted, created_at);
CREATE INDEX IF NOT EXISTS idx_enhancement_history_confidence ON rule_enhancement_history(confidence_score DESC);

-- ============================================
-- EXTEND AGENT_RULES TABLE
-- Add AI-specific columns to existing agent_rules table
-- ============================================
ALTER TABLE agent_rules ADD COLUMN ai_enhanced INTEGER DEFAULT 0;
ALTER TABLE agent_rules ADD COLUMN enhancement_confidence REAL DEFAULT 0.0;
ALTER TABLE agent_rules ADD COLUMN platform_tags TEXT DEFAULT '[]'; -- JSON array
ALTER TABLE agent_rules ADD COLUMN usage_success_rate REAL DEFAULT 0.0;
ALTER TABLE agent_rules ADD COLUMN template_source TEXT; -- 'user', 'ai_generated', 'template'

-- Add indexes for new AI-related columns
CREATE INDEX IF NOT EXISTS idx_agent_rules_ai_enhanced ON agent_rules(ai_enhanced);
CREATE INDEX IF NOT EXISTS idx_agent_rules_platform_tags ON agent_rules(platform_tags);
CREATE INDEX IF NOT EXISTS idx_agent_rules_template_source ON agent_rules(template_source);

-- ============================================
-- TRIGGERS FOR updated_at
-- ============================================
CREATE TRIGGER IF NOT EXISTS platform_templates_updated_at
    AFTER UPDATE ON platform_templates
    FOR EACH ROW
BEGIN
    UPDATE platform_templates SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ============================================
-- SEED INITIAL PLATFORM TEMPLATES
-- ============================================

-- Shopify Templates
INSERT INTO platform_templates (id, name, description, platform, category, template_content, keywords) VALUES
('tpl-shopify-security', 'Shopify Security Best Practices', 'Security guidelines for Shopify app development', 'shopify', 'security', 
'# Shopify Security Rules

## API Security
- Always validate webhook signatures using HMAC-SHA256
- Use proper OAuth scopes - request only necessary permissions
- Implement rate limiting for API calls
- Store access tokens securely, never in client-side code

## Data Protection
- Follow GDPR compliance for customer data
- Implement proper data encryption for sensitive information
- Use HTTPS for all communications
- Validate all user inputs to prevent injection attacks

## App Security
- Implement proper session management
- Use Content Security Policy (CSP) headers
- Validate all GraphQL queries and mutations
- Implement proper error handling without exposing sensitive data',
'["shopify", "ecommerce", "oauth", "webhook", "graphql"]'),

('tpl-shopify-performance', 'Shopify Performance Optimization', 'Performance best practices for Shopify apps', 'shopify', 'performance',
'# Shopify Performance Rules

## API Optimization
- Use GraphQL instead of REST when possible for better performance
- Implement proper pagination for large datasets
- Use bulk operations for multiple record updates
- Cache frequently accessed data with appropriate TTL

## Frontend Performance
- Optimize Liquid templates for faster rendering
- Minimize JavaScript bundle size
- Use lazy loading for images and non-critical resources
- Implement proper caching strategies

## Database Optimization
- Use proper indexing for frequently queried fields
- Implement connection pooling
- Avoid N+1 queries in data fetching
- Use background jobs for heavy processing',
'["shopify", "performance", "graphql", "liquid", "optimization"]');

-- Stripe Templates
INSERT INTO platform_templates (id, name, description, platform, category, template_content, keywords) VALUES
('tpl-stripe-security', 'Stripe Payment Security', 'Security guidelines for Stripe integration', 'stripe', 'security',
'# Stripe Security Rules

## API Key Management
- Never expose secret keys in client-side code
- Use publishable keys only for client-side operations
- Rotate API keys regularly
- Use restricted API keys with minimal permissions

## Payment Processing
- Always validate webhooks using Stripe signatures
- Implement idempotency for payment operations
- Use HTTPS for all payment-related communications
- Follow PCI DSS compliance requirements

## Error Handling
- Never log sensitive payment information
- Implement proper error handling for failed payments
- Use Stripe''s error codes for consistent error handling
- Implement proper retry logic with exponential backoff',
'["stripe", "payment", "webhook", "pci", "security"]'),

('tpl-stripe-integration', 'Stripe Integration Best Practices', 'Best practices for Stripe API integration', 'stripe', 'integration',
'# Stripe Integration Rules

## Webhook Handling
- Always verify webhook signatures
- Implement proper event handling for all relevant events
- Use idempotency keys for webhook processing
- Handle webhook retries gracefully

## Payment Flow
- Use Payment Intents for modern payment processing
- Implement proper 3D Secure handling
- Handle asynchronous payment confirmations
- Implement proper refund and dispute handling

## Testing and Monitoring
- Use Stripe''s test mode for development
- Implement comprehensive logging for payment events
- Monitor payment success rates and error patterns
- Set up alerts for payment failures',
'["stripe", "webhook", "payment-intent", "3d-secure", "monitoring"]');

-- Next.js Templates
INSERT INTO platform_templates (id, name, description, platform, category, template_content, keywords) VALUES
('tpl-nextjs-performance', 'Next.js Performance Optimization', 'Performance best practices for Next.js applications', 'nextjs', 'performance',
'# Next.js Performance Rules

## Rendering Optimization
- Use Static Site Generation (SSG) when possible
- Implement Incremental Static Regeneration (ISR) for dynamic content
- Use Server-Side Rendering (SSR) only when necessary
- Optimize getStaticProps and getServerSideProps

## Code Splitting
- Use dynamic imports for code splitting
- Implement proper lazy loading for components
- Optimize bundle size with webpack-bundle-analyzer
- Use Next.js built-in optimizations

## Image and Asset Optimization
- Use Next.js Image component for automatic optimization
- Implement proper caching strategies
- Optimize fonts with next/font
- Use CDN for static assets',
'["nextjs", "ssg", "ssr", "isr", "performance", "optimization"]'),

('tpl-nextjs-security', 'Next.js Security Best Practices', 'Security guidelines for Next.js applications', 'nextjs', 'security',
'# Next.js Security Rules

## API Route Security
- Implement proper authentication for API routes
- Use CORS properly for cross-origin requests
- Validate all inputs in API routes
- Implement rate limiting for API endpoints

## Client-Side Security
- Use Content Security Policy (CSP) headers
- Implement proper CSRF protection
- Sanitize user inputs to prevent XSS
- Use HTTPS in production

## Environment and Configuration
- Never expose sensitive environment variables to client
- Use proper environment variable validation
- Implement secure session management
- Use secure headers with next.config.js',
'["nextjs", "api-routes", "csp", "csrf", "xss", "security"]');

-- General Templates
INSERT INTO platform_templates (id, name, description, platform, category, template_content, keywords) VALUES
('tpl-api-security', 'API Security Best Practices', 'General API security guidelines', 'general', 'security',
'# API Security Rules

## Authentication and Authorization
- Implement proper JWT token validation
- Use OAuth 2.0 for third-party integrations
- Implement role-based access control (RBAC)
- Use API keys for service-to-service communication

## Input Validation
- Validate all input parameters
- Implement proper request size limits
- Use parameterized queries to prevent SQL injection
- Sanitize all user inputs

## Rate Limiting and Monitoring
- Implement rate limiting per user/IP
- Log all API requests and responses
- Monitor for suspicious activity patterns
- Implement proper error handling and logging',
'["api", "jwt", "oauth", "rbac", "validation", "security"]'),

('tpl-database-performance', 'Database Performance Optimization', 'Database optimization best practices', 'general', 'performance',
'# Database Performance Rules

## Query Optimization
- Use proper indexing strategies
- Avoid N+1 query problems
- Implement query result caching
- Use database-specific optimization features

## Connection Management
- Implement connection pooling
- Use read replicas for read-heavy workloads
- Implement proper transaction management
- Monitor connection usage and limits

## Schema Design
- Normalize data appropriately
- Use proper data types for columns
- Implement proper foreign key constraints
- Regular database maintenance and cleanup',
'["database", "indexing", "caching", "connection-pooling", "optimization"]');
