-- Output Requirements Library
-- Allows users to save and reuse output requirement templates

CREATE TABLE IF NOT EXISTS output_requirements (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    description TEXT,
    requirements_content TEXT NOT NULL,
    -- Optional: associate with specific use cases
    category TEXT, -- e.g., 'code', 'documentation', 'analysis', 'creative'
    tags TEXT DEFAULT '[]', -- JSON array of strings
    usage_count INTEGER DEFAULT 0,
    is_default INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Index for listing active requirements
CREATE INDEX IF NOT EXISTS idx_output_requirements_active ON output_requirements(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_output_requirements_category ON output_requirements(category, is_active);
CREATE INDEX IF NOT EXISTS idx_output_requirements_usage ON output_requirements(usage_count DESC);

-- Trigger for updated_at
CREATE TRIGGER IF NOT EXISTS output_requirements_updated_at
    AFTER UPDATE ON output_requirements
    FOR EACH ROW
BEGIN
    UPDATE output_requirements SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Seed some default output requirements
INSERT OR IGNORE INTO output_requirements (id, name, description, requirements_content, category, is_default) VALUES
    ('or_code_production', 'Production-Ready Code', 'For generating production-quality code',
     'Provide production-ready code with:
- Comprehensive error handling and input validation
- TypeScript type definitions where applicable
- JSDoc/docstring comments for public APIs
- Unit test examples
- Security best practices applied
- Performance considerations noted', 'code', 1),

    ('or_code_review', 'Code Review Format', 'For code review and analysis tasks',
     'Structure the review as:
1. **Summary**: Brief overview of findings
2. **Critical Issues**: Security vulnerabilities, bugs, or breaking changes
3. **Improvements**: Performance, readability, and maintainability suggestions
4. **Positive Aspects**: Well-implemented patterns to acknowledge
5. **Action Items**: Prioritized list of recommended changes', 'code', 1),

    ('or_documentation', 'Technical Documentation', 'For generating technical docs',
     'Create documentation that includes:
- Clear introduction explaining the purpose
- Prerequisites and setup instructions
- Step-by-step usage examples with code snippets
- API reference if applicable
- Common issues and troubleshooting
- Links to related resources', 'documentation', 1),

    ('or_step_by_step', 'Step-by-Step Guide', 'For instructional content',
     'Provide a detailed walkthrough:
- Number each step clearly
- Include expected outcomes after each step
- Add screenshots or code examples where helpful
- Note potential issues and how to resolve them
- Summarize key points at the end', 'documentation', 1),

    ('or_analysis', 'Analysis Report', 'For analytical tasks',
     'Structure the analysis as:
- **Executive Summary**: Key findings in 2-3 sentences
- **Methodology**: How the analysis was conducted
- **Findings**: Detailed observations with supporting data
- **Recommendations**: Actionable next steps
- **Appendix**: Raw data or additional context', 'analysis', 1);
