-- Migration: Hooks and Custom Agents/Commands
-- Adds support for Claude Code hooks and custom slash commands (subagents)

-- ============================================
-- HOOKS TABLE
-- ============================================
-- Stores hook configurations that run at lifecycle events
CREATE TABLE IF NOT EXISTS hooks (
    id TEXT PRIMARY KEY,
    project_id INTEGER,

    -- Hook identification
    name TEXT NOT NULL,
    description TEXT,

    -- Hook type: PreToolUse, PostToolUse, Notification, Stop, SubagentStop
    hook_type TEXT NOT NULL CHECK (hook_type IN ('PreToolUse', 'PostToolUse', 'Notification', 'Stop', 'SubagentStop')),

    -- Matcher configuration (for PreToolUse/PostToolUse)
    -- Can match specific tools like "Write", "Bash", "Edit", etc.
    tool_matcher TEXT, -- JSON: { "tool": "Write", "pattern": "*.ts" } or glob pattern

    -- The command to execute
    command TEXT NOT NULL,

    -- Working directory (optional, relative to project root)
    working_directory TEXT,

    -- Timeout in milliseconds (default 60000 = 60 seconds)
    timeout_ms INTEGER DEFAULT 60000,

    -- Whether hook is enabled
    is_enabled INTEGER DEFAULT 1,

    -- Order of execution (lower = earlier)
    sort_order INTEGER DEFAULT 0,

    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_hooks_project ON hooks(project_id);
CREATE INDEX idx_hooks_type ON hooks(hook_type);

-- ============================================
-- HOOK TEMPLATES TABLE
-- ============================================
-- Pre-built hook templates users can apply
CREATE TABLE IF NOT EXISTS hook_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT, -- 'formatting', 'linting', 'testing', 'security', 'custom'
    hook_type TEXT NOT NULL,
    tool_matcher TEXT,
    command TEXT NOT NULL,
    timeout_ms INTEGER DEFAULT 60000,

    -- Template variables that users can customize
    -- JSON: [{ "name": "LINT_CMD", "default": "eslint", "description": "Linting command" }]
    variables TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- CUSTOM AGENTS/COMMANDS TABLE
-- ============================================
-- Stores custom slash commands that create specialized agents
CREATE TABLE IF NOT EXISTS custom_agents (
    id TEXT PRIMARY KEY,
    project_id INTEGER,

    -- Command identification
    name TEXT NOT NULL, -- Used as filename: "review-pr" -> .claude/commands/review-pr.md
    display_name TEXT,  -- Human-readable: "PR Code Review"
    description TEXT,

    -- The prompt template content (markdown)
    prompt_content TEXT NOT NULL,

    -- Agent configuration
    -- JSON: { "allowedTools": ["Read", "Grep", "Glob"], "model": "sonnet" }
    agent_config TEXT,

    -- Icon/emoji for UI
    icon TEXT DEFAULT '🤖',

    -- Category for organization
    category TEXT, -- 'code-review', 'testing', 'documentation', 'refactoring', 'security', 'custom'

    -- Whether command is enabled
    is_enabled INTEGER DEFAULT 1,

    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_custom_agents_project ON custom_agents(project_id);
CREATE INDEX idx_custom_agents_category ON custom_agents(category);

-- ============================================
-- AGENT TEMPLATES TABLE
-- ============================================
-- Pre-built agent templates users can apply
CREATE TABLE IF NOT EXISTS agent_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    display_name TEXT,
    description TEXT,
    category TEXT,
    prompt_content TEXT NOT NULL,
    agent_config TEXT,
    icon TEXT DEFAULT '🤖',

    -- Template variables
    variables TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INSERT DEFAULT HOOK TEMPLATES
-- ============================================

-- Formatting hooks
INSERT INTO hook_templates (id, name, description, category, hook_type, tool_matcher, command, variables) VALUES
('hook-tpl-prettier', 'Prettier Format', 'Auto-format files with Prettier after edits', 'formatting', 'PostToolUse', '{"tool": "Write", "pattern": "*.{js,ts,jsx,tsx,json,css,md}"}', 'npx prettier --write "$CLAUDE_FILE_PATH"', '[{"name": "PRETTIER_CONFIG", "default": "", "description": "Path to prettier config"}]'),

('hook-tpl-eslint-fix', 'ESLint Auto-fix', 'Auto-fix ESLint issues after file changes', 'linting', 'PostToolUse', '{"tool": "Write", "pattern": "*.{js,ts,jsx,tsx}"}', 'npx eslint --fix "$CLAUDE_FILE_PATH"', NULL),

('hook-tpl-black', 'Black Formatter (Python)', 'Format Python files with Black', 'formatting', 'PostToolUse', '{"tool": "Write", "pattern": "*.py"}', 'black "$CLAUDE_FILE_PATH"', NULL),

('hook-tpl-rustfmt', 'Rust Formatter', 'Format Rust files with rustfmt', 'formatting', 'PostToolUse', '{"tool": "Write", "pattern": "*.rs"}', 'rustfmt "$CLAUDE_FILE_PATH"', NULL),

('hook-tpl-gofmt', 'Go Formatter', 'Format Go files with gofmt', 'formatting', 'PostToolUse', '{"tool": "Write", "pattern": "*.go"}', 'gofmt -w "$CLAUDE_FILE_PATH"', NULL);

-- Testing hooks
INSERT INTO hook_templates (id, name, description, category, hook_type, tool_matcher, command, variables) VALUES
('hook-tpl-jest', 'Jest Test Runner', 'Run related Jest tests after changes', 'testing', 'PostToolUse', '{"tool": "Write", "pattern": "*.{js,ts,jsx,tsx}"}', 'npx jest --findRelatedTests "$CLAUDE_FILE_PATH" --passWithNoTests', NULL),

('hook-tpl-pytest', 'Pytest Runner', 'Run pytest after Python file changes', 'testing', 'PostToolUse', '{"tool": "Write", "pattern": "*.py"}', 'pytest "$CLAUDE_FILE_PATH" -v', NULL),

('hook-tpl-typecheck', 'TypeScript Type Check', 'Run TypeScript type checking', 'testing', 'PostToolUse', '{"tool": "Write", "pattern": "*.{ts,tsx}"}', 'npx tsc --noEmit', '[{"name": "TSCONFIG", "default": "tsconfig.json", "description": "TypeScript config path"}]');

-- Security hooks
INSERT INTO hook_templates (id, name, description, category, hook_type, tool_matcher, command, variables) VALUES
('hook-tpl-secrets', 'Secret Scanner', 'Scan for accidentally committed secrets', 'security', 'PreToolUse', '{"tool": "Bash", "pattern": "git commit*"}', 'git secrets --scan', NULL),

('hook-tpl-audit', 'Dependency Audit', 'Check for vulnerable dependencies', 'security', 'PostToolUse', '{"tool": "Write", "pattern": "package.json"}', 'npm audit --audit-level=high', NULL);

-- Notification hooks
INSERT INTO hook_templates (id, name, description, category, hook_type, tool_matcher, command, variables) VALUES
('hook-tpl-notify-done', 'Desktop Notification', 'Show desktop notification when task completes', 'notification', 'Stop', NULL, 'osascript -e ''display notification "Claude completed the task" with title "Claude Code"''', NULL),

('hook-tpl-slack-notify', 'Slack Notification', 'Send Slack notification on completion', 'notification', 'Stop', NULL, 'curl -X POST -H "Content-type: application/json" --data ''{"text":"Claude Code task completed"}'' $SLACK_WEBHOOK_URL', '[{"name": "SLACK_WEBHOOK_URL", "default": "", "description": "Slack webhook URL"}]');

-- ============================================
-- INSERT DEFAULT AGENT TEMPLATES
-- ============================================

INSERT INTO agent_templates (id, name, display_name, description, category, prompt_content, agent_config, icon) VALUES
('agent-tpl-code-review', 'review', 'Code Review', 'Thorough code review with actionable feedback', 'code-review',
'# Code Review Agent

Review the code changes and provide comprehensive feedback.

## Review Checklist
- [ ] Code correctness and logic
- [ ] Error handling
- [ ] Security vulnerabilities
- [ ] Performance implications
- [ ] Code style and readability
- [ ] Test coverage
- [ ] Documentation

## Instructions
1. Read the files or diff provided: $ARGUMENTS
2. Analyze each change thoroughly
3. Provide specific, actionable feedback
4. Categorize issues by severity (critical, warning, suggestion)
5. Highlight any security concerns
6. Suggest improvements with code examples

## Output Format
Provide feedback in this structure:
- **Critical Issues**: Must fix before merge
- **Warnings**: Should address
- **Suggestions**: Nice to have improvements
- **Positive Notes**: What was done well',
'{"allowedTools": ["Read", "Grep", "Glob", "Bash"]}', '🔍'),

('agent-tpl-write-tests', 'test', 'Test Generator', 'Generate comprehensive tests for code', 'testing',
'# Test Generation Agent

Generate comprehensive tests for the specified code.

## Instructions
1. Analyze the code in: $ARGUMENTS
2. Identify all testable functions, methods, and behaviors
3. Generate tests covering:
   - Happy path scenarios
   - Edge cases
   - Error conditions
   - Boundary values
4. Use the project''s existing test framework and patterns
5. Include setup/teardown as needed
6. Add descriptive test names

## Test Categories
- Unit tests for individual functions
- Integration tests for component interactions
- Edge case tests for boundary conditions

## Output
Write test files following the project''s conventions.',
'{"allowedTools": ["Read", "Write", "Grep", "Glob", "Bash"]}', '🧪'),

('agent-tpl-refactor', 'refactor', 'Refactoring Assistant', 'Refactor code for better quality', 'refactoring',
'# Refactoring Agent

Refactor the specified code to improve quality.

## Refactoring Goals
- Improve readability and maintainability
- Reduce complexity (cyclomatic, cognitive)
- Apply SOLID principles
- Remove code duplication (DRY)
- Improve naming and structure

## Instructions
1. Analyze the code: $ARGUMENTS
2. Identify refactoring opportunities
3. Explain the proposed changes and why
4. Implement refactoring incrementally
5. Ensure tests still pass after each change
6. Document any breaking changes

## Constraints
- Maintain backward compatibility unless explicitly requested
- Keep changes focused and reviewable
- Preserve existing functionality',
'{"allowedTools": ["Read", "Write", "Edit", "Grep", "Glob", "Bash"]}', '♻️'),

('agent-tpl-document', 'docs', 'Documentation Writer', 'Generate comprehensive documentation', 'documentation',
'# Documentation Agent

Generate or update documentation for the codebase.

## Documentation Types
- README files
- API documentation
- Code comments and JSDoc/docstrings
- Architecture documentation
- Usage examples

## Instructions
1. Analyze the code: $ARGUMENTS
2. Identify what needs documentation
3. Generate clear, comprehensive docs
4. Include code examples where helpful
5. Follow the project''s documentation style

## Quality Standards
- Clear and concise language
- Accurate technical details
- Helpful examples
- Proper formatting (Markdown)',
'{"allowedTools": ["Read", "Write", "Grep", "Glob"]}', '📝'),

('agent-tpl-security', 'security', 'Security Auditor', 'Audit code for security vulnerabilities', 'security',
'# Security Audit Agent

Perform a security audit on the specified code.

## Security Checklist
- [ ] Input validation and sanitization
- [ ] Authentication and authorization
- [ ] SQL injection vulnerabilities
- [ ] XSS vulnerabilities
- [ ] CSRF protection
- [ ] Sensitive data exposure
- [ ] Security misconfigurations
- [ ] Dependency vulnerabilities

## Instructions
1. Analyze the code: $ARGUMENTS
2. Check against OWASP Top 10
3. Identify potential vulnerabilities
4. Assess severity (Critical, High, Medium, Low)
5. Provide remediation guidance with code examples

## Output Format
- **Vulnerability**: Description
- **Severity**: Critical/High/Medium/Low
- **Location**: File and line
- **Remediation**: How to fix with example',
'{"allowedTools": ["Read", "Grep", "Glob", "Bash"]}', '🔒'),

('agent-tpl-explain', 'explain', 'Code Explainer', 'Explain how code works in detail', 'documentation',
'# Code Explanation Agent

Provide a detailed explanation of how the code works.

## Instructions
1. Read and analyze: $ARGUMENTS
2. Explain the overall purpose and architecture
3. Break down key components and their roles
4. Trace the flow of data/execution
5. Highlight important patterns or techniques used
6. Note any potential issues or areas of concern

## Explanation Levels
- High-level overview (architecture)
- Component-level (modules, classes)
- Function-level (detailed logic)

## Output
Provide clear explanations suitable for developers unfamiliar with this code.',
'{"allowedTools": ["Read", "Grep", "Glob"]}', '💡'),

('agent-tpl-optimize', 'optimize', 'Performance Optimizer', 'Optimize code for better performance', 'refactoring',
'# Performance Optimization Agent

Analyze and optimize code for better performance.

## Optimization Areas
- Algorithm efficiency (time complexity)
- Memory usage (space complexity)
- Database query optimization
- Caching opportunities
- Lazy loading and code splitting
- Network request optimization

## Instructions
1. Profile/analyze the code: $ARGUMENTS
2. Identify performance bottlenecks
3. Suggest optimizations with expected impact
4. Implement changes incrementally
5. Measure improvements where possible

## Constraints
- Maintain code readability
- Don''t over-optimize prematurely
- Document performance trade-offs',
'{"allowedTools": ["Read", "Write", "Edit", "Grep", "Glob", "Bash"]}', '⚡'),

('agent-tpl-migrate', 'migrate', 'Migration Assistant', 'Help migrate code to new versions/frameworks', 'refactoring',
'# Migration Agent

Assist with code migration tasks.

## Migration Types
- Framework version upgrades
- Library replacements
- Language version updates
- API migrations
- Database schema migrations

## Instructions
1. Understand the migration goal: $ARGUMENTS
2. Analyze current implementation
3. Research breaking changes and migration guides
4. Create a migration plan
5. Implement changes incrementally
6. Update tests and documentation
7. Verify functionality after migration

## Output
Provide a detailed migration plan and implement changes safely.',
'{"allowedTools": ["Read", "Write", "Edit", "Grep", "Glob", "Bash", "WebFetch"]}', '🔄');
