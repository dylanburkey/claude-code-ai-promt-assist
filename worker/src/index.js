/**
 * Semantic Prompt Workstation - Cloudflare Worker with Hono
 * Serves static assets and provides API endpoints for D1 database operations
 * Enhanced with Workers AI for prompt optimization and Claude Code export
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";

const app = new Hono();

// ============================================
// MIDDLEWARE
// ============================================

// CORS middleware
app.use(
  "/api/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

// Security headers for all responses
app.use(
  "*",
  secureHeaders({
    xFrameOptions: "DENY",
    xContentTypeOptions: "nosniff",
    referrerPolicy: "strict-origin-when-cross-origin",
  }),
);

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateId() {
  return crypto.randomUUID().replace(/-/g, "");
}

// ============================================
// WORKERS AI ENDPOINTS
// ============================================

// Enhance/cleanup prompt text
app.post("/api/ai/enhance-prompt", async (c) => {
  const ai = c.env.AI;

  if (!ai) {
    return c.json({ error: "AI binding not configured" }, 500);
  }

  const body = await c.req.json();
  const { prompt, enhancementType = "general" } = body;

  if (!prompt) {
    return c.json({ error: "Prompt text is required" }, 400);
  }

  const enhancementPrompts = {
    general: `Improve this prompt for clarity and effectiveness while preserving its intent. Make it more specific and actionable:\n\n${prompt}`,
    technical: `Enhance this technical prompt with precise terminology, clear requirements, and structured format:\n\n${prompt}`,
    creative: `Enhance this creative prompt to be more evocative and inspiring while maintaining clear direction:\n\n${prompt}`,
    concise: `Make this prompt more concise and direct while preserving all essential information:\n\n${prompt}`,
    claude_optimize: `Optimize this prompt specifically for Claude AI. Use clear XML-style structure, explicit constraints, and well-defined output requirements:\n\n${prompt}`,
  };

  const systemPrompt =
    enhancementPrompts[enhancementType] || enhancementPrompts.general;

  try {
    const response = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        {
          role: "system",
          content:
            "You are an expert prompt engineer. Your task is to improve prompts while preserving their original intent. Output only the improved prompt, no explanations.",
        },
        { role: "user", content: systemPrompt },
      ],
      max_tokens: 2048,
      temperature: 0.3,
    });

    return c.json({
      original: prompt,
      enhanced: response.response,
      enhancementType,
    });
  } catch (error) {
    return c.json(
      { error: "AI enhancement failed", details: error.message },
      500,
    );
  }
});

// Get improvement suggestions for a prompt
app.post("/api/ai/suggest-improvements", async (c) => {
  const ai = c.env.AI;

  if (!ai) {
    return c.json({ error: "AI binding not configured" }, 500);
  }

  const body = await c.req.json();
  const { prompt } = body;

  if (!prompt) {
    return c.json({ error: "Prompt text is required" }, 400);
  }

  try {
    const response = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        {
          role: "system",
          content:
            "You are a prompt engineering expert. Analyze prompts and provide actionable improvement suggestions. Always respond with valid JSON array format.",
        },
        {
          role: "user",
          content: `Analyze this prompt and provide 3-5 specific improvement suggestions. Return as JSON array with objects containing "suggestion" and "priority" (high/medium/low) fields only:\n\n${prompt}`,
        },
      ],
      max_tokens: 1024,
      temperature: 0.5,
    });

    // Try to parse the response as JSON
    let suggestions;
    try {
      // Extract JSON from the response
      const jsonMatch = response.response.match(/\[[\s\S]*\]/);
      suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch {
      // If parsing fails, return raw suggestions
      suggestions = [{ suggestion: response.response, priority: "medium" }];
    }

    return c.json({ suggestions });
  } catch (error) {
    return c.json(
      { error: "AI suggestion failed", details: error.message },
      500,
    );
  }
});

// Analyze prompt quality
app.post("/api/ai/analyze-prompt", async (c) => {
  const ai = c.env.AI;

  if (!ai) {
    return c.json({ error: "AI binding not configured" }, 500);
  }

  const body = await c.req.json();
  const { prompt } = body;

  if (!prompt) {
    return c.json({ error: "Prompt text is required" }, 400);
  }

  try {
    const response = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        {
          role: "system",
          content:
            "You are a prompt quality analyst. Score prompts on multiple dimensions and provide brief analysis. Always respond with valid JSON.",
        },
        {
          role: "user",
          content: `Analyze this prompt's quality. Return JSON with: clarity (1-10), specificity (1-10), structure (1-10), overall (1-10), and summary (brief text):\n\n${prompt}`,
        },
      ],
      max_tokens: 512,
      temperature: 0.2,
    });

    // Try to parse the response as JSON
    let analysis;
    try {
      const jsonMatch = response.response.match(/\{[\s\S]*\}/);
      analysis = jsonMatch
        ? JSON.parse(jsonMatch[0])
        : { overall: 5, summary: response.response };
    } catch {
      analysis = {
        clarity: 5,
        specificity: 5,
        structure: 5,
        overall: 5,
        summary: response.response,
      };
    }

    return c.json({ analysis });
  } catch (error) {
    return c.json({ error: "AI analysis failed", details: error.message }, 500);
  }
});

// ============================================
// CLAUDE CODE EXPORT ENDPOINTS
// ============================================

// Export prompt in Claude Code optimized format
app.post("/api/export/claude-code", async (c) => {
  const body = await c.req.json();
  const {
    agent,
    prompt,
    context = "",
    constraints = "",
    outputRequirements = "",
    includeSystemPrompt = true,
  } = body;

  if (!prompt) {
    return c.json({ error: "Prompt is required" }, 400);
  }

  // Build Claude Code optimized XML structure
  let userPrompt = "";

  if (context) {
    userPrompt += `<context>\n${context}\n</context>\n\n`;
  }

  userPrompt += `<instructions>\n${prompt}\n</instructions>\n`;

  if (constraints) {
    userPrompt += `\n<constraints>\n${constraints}\n</constraints>\n`;
  }

  if (outputRequirements) {
    userPrompt += `\n<output_requirements>\n${outputRequirements}\n</output_requirements>\n`;
  }

  // Generate system prompt from agent if provided
  let systemPrompt = null;
  if (includeSystemPrompt && agent) {
    systemPrompt = `You are ${agent.name}, ${agent.role}.`;
    if (agent.style) {
      systemPrompt += `\nStyle: ${agent.style}`;
    }
    if (agent.description) {
      systemPrompt += `\n${agent.description}`;
    }
  }

  return c.json({
    format: "claude-code",
    userPrompt: userPrompt.trim(),
    systemPrompt,
    metadata: {
      exportedAt: new Date().toISOString(),
      hasAgent: !!agent,
      hasConstraints: !!constraints,
      hasOutputRequirements: !!outputRequirements,
    },
  });
});

// Export as downloadable Claude Code file
app.post("/api/export/claude-code-file", async (c) => {
  const body = await c.req.json();
  const {
    agent,
    prompt,
    context = "",
    constraints = "",
    outputRequirements = "",
    projectName = "prompt",
  } = body;

  if (!prompt) {
    return c.json({ error: "Prompt is required" }, 400);
  }

  // Build the markdown file content
  let content = `# ${projectName}\n\n`;
  content += `> Generated by Semantic Prompt Workstation\n`;
  content += `> Optimized for Claude Code\n\n`;

  if (agent) {
    content += `## Agent\n\n`;
    content += `**${agent.name}** - ${agent.role}\n`;
    if (agent.style) content += `\n*Style: ${agent.style}*\n`;
    if (agent.description) content += `\n${agent.description}\n`;
    content += `\n---\n\n`;
  }

  content += `## Prompt\n\n`;
  content += "```xml\n";

  if (context) {
    content += `<context>\n${context}\n</context>\n\n`;
  }

  content += `<instructions>\n${prompt}\n</instructions>\n`;

  if (constraints) {
    content += `\n<constraints>\n${constraints}\n</constraints>\n`;
  }

  if (outputRequirements) {
    content += `\n<output_requirements>\n${outputRequirements}\n</output_requirements>\n`;
  }

  content += "```\n\n";

  content += `---\n\n`;
  content += `## Usage\n\n`;
  content += `1. Copy the XML prompt above\n`;
  content += `2. Paste into Claude Code or Claude chat\n`;
  content += `3. The structured format helps Claude parse your intent clearly\n`;

  return new Response(content, {
    headers: {
      "Content-Type": "text/markdown",
      "Content-Disposition": `attachment; filename="${projectName}-prompt.md"`,
    },
  });
});

// Generate CLAUDE.md project file
app.post("/api/export/claude-md", async (c) => {
  const body = await c.req.json();
  const {
    projectName = "Project",
    agent,
    constraints = "",
    codeStyle = "",
    testingRequirements = "",
    additionalContext = "",
  } = body;

  let content = `# ${projectName}\n\n`;

  if (agent) {
    content += `## AI Assistant Configuration\n\n`;
    content += `When working on this project, act as **${agent.name}**, ${agent.role}.\n`;
    if (agent.style) content += `\nCommunication style: ${agent.style}\n`;
    if (agent.description) content += `\n${agent.description}\n`;
    content += `\n`;
  }

  if (constraints) {
    content += `## Constraints\n\n`;
    content += `${constraints}\n\n`;
  }

  if (codeStyle) {
    content += `## Code Style\n\n`;
    content += `${codeStyle}\n\n`;
  }

  if (testingRequirements) {
    content += `## Testing Requirements\n\n`;
    content += `${testingRequirements}\n\n`;
  }

  if (additionalContext) {
    content += `## Additional Context\n\n`;
    content += `${additionalContext}\n\n`;
  }

  content += `---\n`;
  content += `*Generated by Semantic Prompt Workstation*\n`;

  return new Response(content, {
    headers: {
      "Content-Type": "text/markdown",
      "Content-Disposition": `attachment; filename="CLAUDE.md"`,
    },
  });
});

// ============================================
// AGENTS API
// ============================================

// List all agents
app.get("/api/agents", async (c) => {
  const db = c.env.DB;
  const result = await db
    .prepare(
      "SELECT * FROM agents WHERE is_active = 1 ORDER BY created_at DESC",
    )
    .all();
  return c.json(result.results);
});

// Get single agent
app.get("/api/agents/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const result = await db
    .prepare("SELECT * FROM agents WHERE id = ?")
    .bind(id)
    .first();

  if (!result) {
    return c.json({ error: "Agent not found" }, 404);
  }
  return c.json(result);
});

// Create agent
app.post("/api/agents", async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const { name, role, style, description, system_prompt } = body;

  if (!name || !role) {
    return c.json({ error: "Name and role are required" }, 400);
  }

  const id = generateId();
  await db
    .prepare(
      "INSERT INTO agents (id, name, role, style, description, system_prompt) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(id, name, role, style || "", description || "", system_prompt || "")
    .run();

  const agent = await db
    .prepare("SELECT * FROM agents WHERE id = ?")
    .bind(id)
    .first();
  return c.json(agent, 201);
});

// Update agent
app.put("/api/agents/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const body = await c.req.json();

  const existing = await db
    .prepare("SELECT * FROM agents WHERE id = ?")
    .bind(id)
    .first();

  if (!existing) {
    return c.json({ error: "Agent not found" }, 404);
  }

  await db
    .prepare(
      `UPDATE agents
       SET name = ?, role = ?, style = ?, description = ?, system_prompt = ?, is_active = ?
       WHERE id = ?`,
    )
    .bind(
      body.name ?? existing.name,
      body.role ?? existing.role,
      body.style ?? existing.style,
      body.description ?? existing.description,
      body.system_prompt ?? existing.system_prompt ?? "",
      body.is_active ?? existing.is_active,
      id,
    )
    .run();

  const agent = await db
    .prepare("SELECT * FROM agents WHERE id = ?")
    .bind(id)
    .first();
  return c.json(agent);
});

// Delete agent (soft delete)
app.delete("/api/agents/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  const result = await db
    .prepare("UPDATE agents SET is_active = 0 WHERE id = ?")
    .bind(id)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: "Agent not found" }, 404);
  }
  return c.json({ success: true });
});

// ============================================
// PROMPT TEMPLATES API
// ============================================

// List templates
app.get("/api/templates", async (c) => {
  const db = c.env.DB;
  const result = await db
    .prepare(
      "SELECT * FROM prompt_templates WHERE is_active = 1 ORDER BY usage_count DESC, created_at DESC",
    )
    .all();
  return c.json(result.results);
});

// Get single template
app.get("/api/templates/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const result = await db
    .prepare("SELECT * FROM prompt_templates WHERE id = ?")
    .bind(id)
    .first();

  if (!result) {
    return c.json({ error: "Template not found" }, 404);
  }
  return c.json(result);
});

// Create template
app.post("/api/templates", async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const { name, description, template_content, placeholders, category, tags } =
    body;

  if (!name || !template_content) {
    return c.json({ error: "Name and template_content are required" }, 400);
  }

  const id = generateId();
  await db
    .prepare(
      `INSERT INTO prompt_templates
       (id, name, description, template_content, placeholders, category, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      name,
      description || "",
      template_content,
      JSON.stringify(placeholders || []),
      category || null,
      JSON.stringify(tags || []),
    )
    .run();

  const template = await db
    .prepare("SELECT * FROM prompt_templates WHERE id = ?")
    .bind(id)
    .first();
  return c.json(template, 201);
});

// Update template
app.put("/api/templates/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const body = await c.req.json();

  const existing = await db
    .prepare("SELECT * FROM prompt_templates WHERE id = ?")
    .bind(id)
    .first();

  if (!existing) {
    return c.json({ error: "Template not found" }, 404);
  }

  await db
    .prepare(
      `UPDATE prompt_templates
       SET name = ?, description = ?, template_content = ?,
           placeholders = ?, category = ?, tags = ?, is_active = ?
       WHERE id = ?`,
    )
    .bind(
      body.name ?? existing.name,
      body.description ?? existing.description,
      body.template_content ?? existing.template_content,
      body.placeholders
        ? JSON.stringify(body.placeholders)
        : existing.placeholders,
      body.category ?? existing.category,
      body.tags ? JSON.stringify(body.tags) : existing.tags,
      body.is_active ?? existing.is_active,
      id,
    )
    .run();

  const template = await db
    .prepare("SELECT * FROM prompt_templates WHERE id = ?")
    .bind(id)
    .first();
  return c.json(template);
});

// Delete template (soft delete)
app.delete("/api/templates/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  const result = await db
    .prepare("UPDATE prompt_templates SET is_active = 0 WHERE id = ?")
    .bind(id)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: "Template not found" }, 404);
  }
  return c.json({ success: true });
});

// ============================================
// OUTPUT REQUIREMENTS API
// ============================================

// List output requirements
app.get("/api/output-requirements", async (c) => {
  const db = c.env.DB;
  const category = c.req.query("category");

  let query = "SELECT * FROM output_requirements WHERE is_active = 1";
  const params = [];

  if (category) {
    query += " AND category = ?";
    params.push(category);
  }

  query += " ORDER BY usage_count DESC, created_at DESC";

  const stmt = db.prepare(query);
  const result =
    params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();
  return c.json(result.results);
});

// Get single output requirement
app.get("/api/output-requirements/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const result = await db
    .prepare("SELECT * FROM output_requirements WHERE id = ?")
    .bind(id)
    .first();

  if (!result) {
    return c.json({ error: "Output requirement not found" }, 404);
  }
  return c.json(result);
});

// Create output requirement
app.post("/api/output-requirements", async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const { name, description, requirements_content, category, tags } = body;

  if (!name || !requirements_content) {
    return c.json({ error: "Name and requirements_content are required" }, 400);
  }

  const id = generateId();
  await db
    .prepare(
      `INSERT INTO output_requirements
       (id, name, description, requirements_content, category, tags)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      name,
      description || "",
      requirements_content,
      category || null,
      JSON.stringify(tags || []),
    )
    .run();

  const requirement = await db
    .prepare("SELECT * FROM output_requirements WHERE id = ?")
    .bind(id)
    .first();
  return c.json(requirement, 201);
});

// Update output requirement
app.put("/api/output-requirements/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const body = await c.req.json();

  const existing = await db
    .prepare("SELECT * FROM output_requirements WHERE id = ?")
    .bind(id)
    .first();

  if (!existing) {
    return c.json({ error: "Output requirement not found" }, 404);
  }

  await db
    .prepare(
      `UPDATE output_requirements
       SET name = ?, description = ?, requirements_content = ?,
           category = ?, tags = ?, is_active = ?
       WHERE id = ?`,
    )
    .bind(
      body.name ?? existing.name,
      body.description ?? existing.description,
      body.requirements_content ?? existing.requirements_content,
      body.category ?? existing.category,
      body.tags ? JSON.stringify(body.tags) : existing.tags,
      body.is_active ?? existing.is_active,
      id,
    )
    .run();

  const requirement = await db
    .prepare("SELECT * FROM output_requirements WHERE id = ?")
    .bind(id)
    .first();
  return c.json(requirement);
});

// Delete output requirement (soft delete)
app.delete("/api/output-requirements/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  const result = await db
    .prepare("UPDATE output_requirements SET is_active = 0 WHERE id = ?")
    .bind(id)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: "Output requirement not found" }, 404);
  }
  return c.json({ success: true });
});

// Increment usage count
app.post("/api/output-requirements/:id/use", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  await db
    .prepare(
      "UPDATE output_requirements SET usage_count = usage_count + 1 WHERE id = ?",
    )
    .bind(id)
    .run();

  return c.json({ success: true });
});

// ============================================
// IDES API (read-only)
// ============================================

app.get("/api/ides", async (c) => {
  const db = c.env.DB;
  const result = await db
    .prepare("SELECT * FROM ides WHERE is_active = 1 ORDER BY display_name")
    .all();
  return c.json(result.results);
});

// ============================================
// AGENT RULES API
// ============================================

// List rules with optional filters
app.get("/api/rules", async (c) => {
  const db = c.env.DB;
  const ideId = c.req.query("ide_id");
  const agentId = c.req.query("agent_id");
  const category = c.req.query("category");

  let query = "SELECT * FROM agent_rules WHERE is_active = 1";
  const params = [];

  if (ideId) {
    query += " AND ide_id = ?";
    params.push(ideId);
  }
  if (agentId) {
    query += " AND agent_id = ?";
    params.push(agentId);
  }
  if (category) {
    query += " AND category = ?";
    params.push(category);
  }

  query += " ORDER BY priority DESC, created_at DESC";

  const stmt = db.prepare(query);
  const result =
    params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();
  return c.json(result.results);
});

// Get single rule
app.get("/api/rules/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const result = await db
    .prepare("SELECT * FROM agent_rules WHERE id = ?")
    .bind(id)
    .first();

  if (!result) {
    return c.json({ error: "Rule not found" }, 404);
  }
  return c.json(result);
});

// Create rule
app.post("/api/rules", async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const {
    name,
    description,
    rule_content,
    ide_id,
    agent_id,
    category,
    priority,
    tags,
  } = body;

  if (!name || !rule_content) {
    return c.json({ error: "Name and rule_content are required" }, 400);
  }

  const id = generateId();
  await db
    .prepare(
      `INSERT INTO agent_rules
       (id, name, description, rule_content, ide_id, agent_id, category, priority, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      name,
      description || "",
      rule_content,
      ide_id || null,
      agent_id || null,
      category || null,
      priority || 0,
      JSON.stringify(tags || []),
    )
    .run();

  const rule = await db
    .prepare("SELECT * FROM agent_rules WHERE id = ?")
    .bind(id)
    .first();
  return c.json(rule, 201);
});

// Update rule
app.put("/api/rules/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const body = await c.req.json();

  const existing = await db
    .prepare("SELECT * FROM agent_rules WHERE id = ?")
    .bind(id)
    .first();

  if (!existing) {
    return c.json({ error: "Rule not found" }, 404);
  }

  await db
    .prepare(
      `UPDATE agent_rules
       SET name = ?, description = ?, rule_content = ?, ide_id = ?,
           agent_id = ?, category = ?, priority = ?, tags = ?, is_active = ?
       WHERE id = ?`,
    )
    .bind(
      body.name ?? existing.name,
      body.description ?? existing.description,
      body.rule_content ?? existing.rule_content,
      body.ide_id !== undefined ? body.ide_id : existing.ide_id,
      body.agent_id !== undefined ? body.agent_id : existing.agent_id,
      body.category ?? existing.category,
      body.priority ?? existing.priority,
      body.tags ? JSON.stringify(body.tags) : existing.tags,
      body.is_active ?? existing.is_active,
      id,
    )
    .run();

  const rule = await db
    .prepare("SELECT * FROM agent_rules WHERE id = ?")
    .bind(id)
    .first();
  return c.json(rule);
});

// Delete rule (soft delete)
app.delete("/api/rules/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  const result = await db
    .prepare("UPDATE agent_rules SET is_active = 0 WHERE id = ?")
    .bind(id)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: "Rule not found" }, 404);
  }
  return c.json({ success: true });
});

// ============================================
// PROJECT PLANS API
// ============================================

// List plans
app.get("/api/plans", async (c) => {
  const db = c.env.DB;
  const status = c.req.query("status");

  let query = "SELECT * FROM project_plans WHERE 1=1";
  const params = [];

  if (status) {
    query += " AND status = ?";
    params.push(status);
  }

  query += " ORDER BY created_at DESC";

  const stmt = db.prepare(query);
  const result =
    params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();
  return c.json(result.results);
});

// Get plan with steps
app.get("/api/plans/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  const plan = await db
    .prepare("SELECT * FROM project_plans WHERE id = ?")
    .bind(id)
    .first();

  if (!plan) {
    return c.json({ error: "Plan not found" }, 404);
  }

  const steps = await db
    .prepare("SELECT * FROM plan_steps WHERE plan_id = ? ORDER BY step_number")
    .bind(id)
    .all();

  return c.json({ ...plan, steps: steps.results });
});

// Get plan with steps and linked prompts (full view)
app.get("/api/plans/:id/full", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  const plan = await db
    .prepare("SELECT * FROM project_plans WHERE id = ?")
    .bind(id)
    .first();

  if (!plan) {
    return c.json({ error: "Plan not found" }, 404);
  }

  // Get steps with linked prompts
  const steps = await db
    .prepare(
      `
      SELECT
        ps.*,
        pt.name as prompt_name,
        pt.template_content as prompt_content
      FROM plan_steps ps
      LEFT JOIN prompt_templates pt ON ps.prompt_id = pt.id
      WHERE ps.plan_id = ?
      ORDER BY ps.step_number
    `,
    )
    .bind(id)
    .all();

  return c.json({
    ...plan,
    steps: steps.results.map((step) => ({
      ...step,
      linkedPrompt: step.prompt_id
        ? {
            id: step.prompt_id,
            name: step.prompt_name,
            content: step.prompt_content,
          }
        : null,
    })),
  });
});

// Create plan
app.post("/api/plans", async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const { title, description, raw_input, priority, tags } = body;

  if (!title || !raw_input) {
    return c.json({ error: "Title and raw_input are required" }, 400);
  }

  const id = generateId();
  await db
    .prepare(
      `INSERT INTO project_plans
       (id, title, description, raw_input, priority, tags)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      title,
      description || "",
      raw_input,
      priority || "medium",
      JSON.stringify(tags || []),
    )
    .run();

  const plan = await db
    .prepare("SELECT * FROM project_plans WHERE id = ?")
    .bind(id)
    .first();
  return c.json(plan, 201);
});

// Update plan
app.put("/api/plans/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const body = await c.req.json();

  const existing = await db
    .prepare("SELECT * FROM project_plans WHERE id = ?")
    .bind(id)
    .first();

  if (!existing) {
    return c.json({ error: "Plan not found" }, 404);
  }

  await db
    .prepare(
      `UPDATE project_plans
       SET title = ?, description = ?, raw_input = ?, status = ?,
           priority = ?, estimated_complexity = ?, tags = ?,
           started_at = ?, completed_at = ?
       WHERE id = ?`,
    )
    .bind(
      body.title ?? existing.title,
      body.description ?? existing.description,
      body.raw_input ?? existing.raw_input,
      body.status ?? existing.status,
      body.priority ?? existing.priority,
      body.estimated_complexity ?? existing.estimated_complexity,
      body.tags ? JSON.stringify(body.tags) : existing.tags,
      body.started_at ?? existing.started_at,
      body.completed_at ?? existing.completed_at,
      id,
    )
    .run();

  const plan = await db
    .prepare("SELECT * FROM project_plans WHERE id = ?")
    .bind(id)
    .first();
  return c.json(plan);
});

// Delete plan (cascade deletes steps)
app.delete("/api/plans/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  const result = await db
    .prepare("DELETE FROM project_plans WHERE id = ?")
    .bind(id)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: "Plan not found" }, 404);
  }
  return c.json({ success: true });
});

// ============================================
// PLAN STEPS API
// ============================================

// Create step for a plan
app.post("/api/plans/:planId/steps", async (c) => {
  const db = c.env.DB;
  const planId = c.req.param("planId");
  const body = await c.req.json();
  const {
    step_number,
    title,
    description,
    semantic_prompt,
    estimated_effort,
    depends_on,
  } = body;

  if (!title) {
    return c.json({ error: "Title is required" }, 400);
  }

  // Verify plan exists
  const plan = await db
    .prepare("SELECT id FROM project_plans WHERE id = ?")
    .bind(planId)
    .first();

  if (!plan) {
    return c.json({ error: "Plan not found" }, 404);
  }

  // Get next step number if not provided
  let stepNum = step_number;
  if (!stepNum) {
    const maxStep = await db
      .prepare(
        "SELECT MAX(step_number) as max_num FROM plan_steps WHERE plan_id = ?",
      )
      .bind(planId)
      .first();
    stepNum = (maxStep?.max_num || 0) + 1;
  }

  const id = generateId();
  await db
    .prepare(
      `INSERT INTO plan_steps
       (id, plan_id, step_number, title, description, semantic_prompt, estimated_effort, depends_on)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      planId,
      stepNum,
      title,
      description || "",
      semantic_prompt || "",
      estimated_effort || "medium",
      JSON.stringify(depends_on || []),
    )
    .run();

  const step = await db
    .prepare("SELECT * FROM plan_steps WHERE id = ?")
    .bind(id)
    .first();
  return c.json(step, 201);
});

// Update step
app.put("/api/steps/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const body = await c.req.json();

  const existing = await db
    .prepare("SELECT * FROM plan_steps WHERE id = ?")
    .bind(id)
    .first();

  if (!existing) {
    return c.json({ error: "Step not found" }, 404);
  }

  await db
    .prepare(
      `UPDATE plan_steps
       SET step_number = ?, title = ?, description = ?, semantic_prompt = ?,
           status = ?, estimated_effort = ?, depends_on = ?, output_notes = ?,
           completed_at = ?, prompt_id = ?
       WHERE id = ?`,
    )
    .bind(
      body.step_number ?? existing.step_number,
      body.title ?? existing.title,
      body.description ?? existing.description,
      body.semantic_prompt ?? existing.semantic_prompt,
      body.status ?? existing.status,
      body.estimated_effort ?? existing.estimated_effort,
      body.depends_on ? JSON.stringify(body.depends_on) : existing.depends_on,
      body.output_notes ?? existing.output_notes,
      body.completed_at ?? existing.completed_at,
      body.prompt_id !== undefined ? body.prompt_id : existing.prompt_id,
      id,
    )
    .run();

  const step = await db
    .prepare("SELECT * FROM plan_steps WHERE id = ?")
    .bind(id)
    .first();
  return c.json(step);
});

// Link prompt to step
app.post("/api/steps/:stepId/link-prompt", async (c) => {
  const db = c.env.DB;
  const stepId = c.req.param("stepId");
  const body = await c.req.json();
  const { prompt_id } = body;

  const existing = await db
    .prepare("SELECT * FROM plan_steps WHERE id = ?")
    .bind(stepId)
    .first();

  if (!existing) {
    return c.json({ error: "Step not found" }, 404);
  }

  // Verify prompt exists if provided
  if (prompt_id) {
    const prompt = await db
      .prepare("SELECT id FROM prompt_templates WHERE id = ?")
      .bind(prompt_id)
      .first();

    if (!prompt) {
      return c.json({ error: "Prompt not found" }, 404);
    }
  }

  await db
    .prepare("UPDATE plan_steps SET prompt_id = ? WHERE id = ?")
    .bind(prompt_id || null, stepId)
    .run();

  const step = await db
    .prepare("SELECT * FROM plan_steps WHERE id = ?")
    .bind(stepId)
    .first();
  return c.json(step);
});

// Delete step
app.delete("/api/steps/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  const result = await db
    .prepare("DELETE FROM plan_steps WHERE id = ?")
    .bind(id)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: "Step not found" }, 404);
  }
  return c.json({ success: true });
});

// ============================================
// PROJECTS API
// ============================================

// Helper function to generate URL-safe slugs
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 100);
}

// Ensure unique slug
async function ensureUniqueSlug(db, baseSlug, excludeId = null) {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    let query = "SELECT id FROM projects WHERE slug = ?";
    const params = [slug];

    if (excludeId) {
      query += " AND id != ?";
      params.push(excludeId);
    }

    const existing = await db
      .prepare(query)
      .bind(...params)
      .first();
    if (!existing) return slug;

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

// List all projects
app.get("/api/projects", async (c) => {
  const db = c.env.DB;
  const status = c.req.query("status");
  const category = c.req.query("category");
  const includeRelated = c.req.query("include_related") === "true";

  let query = "SELECT * FROM projects WHERE 1=1";
  const params = [];

  if (status) {
    query += " AND status = ?";
    params.push(status);
  }

  if (category) {
    query += " AND category = ?";
    params.push(category);
  }

  query += " ORDER BY updated_at DESC";

  const stmt = db.prepare(query);
  const result =
    params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();

  // Optionally include related projects for each
  if (includeRelated && result.results.length > 0) {
    const projectsWithRelations = await Promise.all(
      result.results.map(async (project) => {
        const relations = await db
          .prepare(
            `
            SELECT pr.*, p.name as related_name, p.slug as related_slug
            FROM project_relationships pr
            JOIN projects p ON p.id = pr.related_project_id
            WHERE pr.source_project_id = ?
          `,
          )
          .bind(project.id)
          .all();
        return { ...project, relationships: relations.results };
      }),
    );
    return c.json(projectsWithRelations);
  }

  return c.json(result.results);
});

// Get project by slug (SEO-friendly URL)
app.get("/api/projects/by-slug/:slug", async (c) => {
  const db = c.env.DB;
  const slug = c.req.param("slug");

  try {
    const project = await db
      .prepare("SELECT * FROM projects WHERE slug = ?")
      .bind(slug)
      .first();

    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    // Get related projects (with error handling)
    let relationships = { results: [] };
    try {
      relationships = await db
        .prepare(
          `
          SELECT pr.*, p.name as related_name, p.slug as related_slug, p.description as related_description, p.cover_image as related_cover_image
          FROM project_relationships pr
          JOIN projects p ON p.id = pr.related_project_id
          WHERE pr.source_project_id = ?
        `,
        )
        .bind(project.id)
        .all();
    } catch (e) {
      console.error("Error fetching relationships:", e);
    }

    // Get linked plans (with error handling)
    let plans = { results: [] };
    try {
      plans = await db
        .prepare(
          `
          SELECT pp.* FROM project_plans pp
          WHERE pp.id IN (SELECT plan_id FROM project_plans_link WHERE project_id = ?)
        `,
        )
        .bind(project.id)
        .all();
    } catch (e) {
      console.error("Error fetching plans:", e);
    }

    // Get assigned agents (with error handling)
    let agents = { results: [] };
    try {
      agents = await db
        .prepare(
          `
          SELECT a.*, pa.is_primary FROM agents a
          JOIN project_agents pa ON pa.agent_id = a.id
          WHERE pa.project_id = ? AND a.is_active = 1
        `,
        )
        .bind(project.id)
        .all();
    } catch (e) {
      console.error("Error fetching agents:", e);
    }

    // Parse tags safely
    let tags = [];
    try {
      tags = project.tags ? JSON.parse(project.tags) : [];
    } catch (e) {
      tags = [];
    }

    return c.json({
      ...project,
      tags,
      relationships: relationships.results,
      plans: plans.results,
      agents: agents.results,
    });
  } catch (error) {
    console.error("Error in get project by slug:", error);
    return c.json(
      { error: "Failed to load project", details: error.message },
      500,
    );
  }
});

// Get project by ID
app.get("/api/projects/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  const project = await db
    .prepare("SELECT * FROM projects WHERE id = ?")
    .bind(id)
    .first();

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  // Get related projects
  const relationships = await db
    .prepare(
      `
      SELECT pr.*, p.name as related_name, p.slug as related_slug, p.description as related_description
      FROM project_relationships pr
      JOIN projects p ON p.id = pr.related_project_id
      WHERE pr.source_project_id = ?
    `,
    )
    .bind(id)
    .all();

  return c.json({
    ...project,
    tags: project.tags ? JSON.parse(project.tags) : [],
    relationships: relationships.results,
  });
});

// Create project
app.post("/api/projects", async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const {
    name,
    description,
    cover_image,
    cover_image_alt,
    project_info,
    status,
    priority,
    category,
    tags,
    ai_context_summary,
    include_in_ai_context,
    started_at,
    target_completion,
  } = body;

  if (!name) {
    return c.json({ error: "Name is required" }, 400);
  }

  const baseSlug = generateSlug(name);
  const slug = await ensureUniqueSlug(db, baseSlug);

  const result = await db
    .prepare(
      `
      INSERT INTO projects
      (slug, name, description, cover_image, cover_image_alt, project_info,
       status, priority, category, tags, ai_context_summary, include_in_ai_context,
       started_at, target_completion)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .bind(
      slug,
      name,
      description || "",
      cover_image || null,
      cover_image_alt || null,
      project_info || "",
      status || "active",
      priority || "medium",
      category || null,
      JSON.stringify(tags || []),
      ai_context_summary || null,
      include_in_ai_context !== undefined ? (include_in_ai_context ? 1 : 0) : 1,
      started_at || null,
      target_completion || null,
    )
    .run();

  // Get the auto-generated ID
  const project = await db
    .prepare("SELECT * FROM projects WHERE slug = ?")
    .bind(slug)
    .first();

  return c.json(project, 201);
});

// Update project
app.put("/api/projects/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const body = await c.req.json();

  const existing = await db
    .prepare("SELECT * FROM projects WHERE id = ?")
    .bind(id)
    .first();

  if (!existing) {
    return c.json({ error: "Project not found" }, 404);
  }

  // Update slug if name changed
  let newSlug = existing.slug;
  if (body.name && body.name !== existing.name) {
    const baseSlug = generateSlug(body.name);
    newSlug = await ensureUniqueSlug(db, baseSlug, id);
  }

  await db
    .prepare(
      `
      UPDATE projects SET
        slug = ?, name = ?, description = ?, cover_image = ?, cover_image_alt = ?,
        project_info = ?, status = ?, priority = ?, category = ?, tags = ?,
        ai_context_summary = ?, include_in_ai_context = ?,
        started_at = ?, target_completion = ?, completed_at = ?
      WHERE id = ?
    `,
    )
    .bind(
      newSlug,
      body.name ?? existing.name,
      body.description ?? existing.description,
      body.cover_image !== undefined ? body.cover_image : existing.cover_image,
      body.cover_image_alt !== undefined
        ? body.cover_image_alt
        : existing.cover_image_alt,
      body.project_info ?? existing.project_info,
      body.status ?? existing.status,
      body.priority ?? existing.priority,
      body.category ?? existing.category,
      body.tags ? JSON.stringify(body.tags) : existing.tags,
      body.ai_context_summary ?? existing.ai_context_summary,
      body.include_in_ai_context !== undefined
        ? body.include_in_ai_context
          ? 1
          : 0
        : existing.include_in_ai_context,
      body.started_at ?? existing.started_at,
      body.target_completion ?? existing.target_completion,
      body.completed_at ?? existing.completed_at,
      id,
    )
    .run();

  const project = await db
    .prepare("SELECT * FROM projects WHERE id = ?")
    .bind(id)
    .first();

  return c.json(project);
});

// Delete project
app.delete("/api/projects/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  const result = await db
    .prepare("DELETE FROM projects WHERE id = ?")
    .bind(id)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: "Project not found" }, 404);
  }

  return c.json({ success: true });
});

// ============================================
// PROJECT RELATIONSHIPS API
// ============================================

// Add relationship between projects
app.post("/api/projects/:id/relationships", async (c) => {
  const db = c.env.DB;
  const sourceId = c.req.param("id");
  const body = await c.req.json();
  const {
    related_project_id,
    relationship_type,
    description,
    is_bidirectional,
  } = body;

  if (!related_project_id) {
    return c.json({ error: "related_project_id is required" }, 400);
  }

  if (sourceId === related_project_id) {
    return c.json({ error: "Cannot create relationship with itself" }, 400);
  }

  // Verify both projects exist
  const [source, related] = await Promise.all([
    db.prepare("SELECT id FROM projects WHERE id = ?").bind(sourceId).first(),
    db
      .prepare("SELECT id FROM projects WHERE id = ?")
      .bind(related_project_id)
      .first(),
  ]);

  if (!source) {
    return c.json({ error: "Source project not found" }, 404);
  }
  if (!related) {
    return c.json({ error: "Related project not found" }, 404);
  }

  const id = generateId();
  const relType = relationship_type || "related";

  try {
    await db
      .prepare(
        `
        INSERT INTO project_relationships
        (id, source_project_id, related_project_id, relationship_type, description, is_bidirectional)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      )
      .bind(
        id,
        sourceId,
        related_project_id,
        relType,
        description || null,
        is_bidirectional ? 1 : 0,
      )
      .run();

    // If bidirectional, create the reverse relationship
    if (is_bidirectional) {
      const reverseId = generateId();
      const reverseType =
        relType === "depends_on"
          ? "blocks"
          : relType === "blocks"
            ? "depends_on"
            : relType === "parent"
              ? "child"
              : relType === "child"
                ? "parent"
                : relType === "successor"
                  ? "predecessor"
                  : relType === "predecessor"
                    ? "successor"
                    : relType;

      await db
        .prepare(
          `
          INSERT OR IGNORE INTO project_relationships
          (id, source_project_id, related_project_id, relationship_type, description, is_bidirectional)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        )
        .bind(
          reverseId,
          related_project_id,
          sourceId,
          reverseType,
          description || null,
          1,
        )
        .run();
    }

    const relationship = await db
      .prepare("SELECT * FROM project_relationships WHERE id = ?")
      .bind(id)
      .first();

    return c.json(relationship, 201);
  } catch (error) {
    if (error.message?.includes("UNIQUE constraint")) {
      return c.json({ error: "Relationship already exists" }, 409);
    }
    throw error;
  }
});

// List relationships for a project
app.get("/api/projects/:id/relationships", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const type = c.req.query("type");

  let query = `
    SELECT pr.*, p.name as related_name, p.slug as related_slug,
           p.description as related_description, p.cover_image as related_cover_image,
           p.status as related_status
    FROM project_relationships pr
    JOIN projects p ON p.id = pr.related_project_id
    WHERE pr.source_project_id = ?
  `;
  const params = [id];

  if (type) {
    query += " AND pr.relationship_type = ?";
    params.push(type);
  }

  query += " ORDER BY pr.created_at DESC";

  const result = await db
    .prepare(query)
    .bind(...params)
    .all();
  return c.json(result.results);
});

// Delete relationship
app.delete("/api/projects/:id/relationships/:relationshipId", async (c) => {
  const db = c.env.DB;
  const projectId = c.req.param("id");
  const relationshipId = c.req.param("relationshipId");

  // Get the relationship to check for bidirectional
  const relationship = await db
    .prepare(
      "SELECT * FROM project_relationships WHERE id = ? AND source_project_id = ?",
    )
    .bind(relationshipId, projectId)
    .first();

  if (!relationship) {
    return c.json({ error: "Relationship not found" }, 404);
  }

  // Delete the relationship
  await db
    .prepare("DELETE FROM project_relationships WHERE id = ?")
    .bind(relationshipId)
    .run();

  // If bidirectional, delete the reverse too
  if (relationship.is_bidirectional) {
    await db
      .prepare(
        `
        DELETE FROM project_relationships
        WHERE source_project_id = ? AND related_project_id = ?
      `,
      )
      .bind(relationship.related_project_id, projectId)
      .run();
  }

  return c.json({ success: true });
});

// ============================================
// PROJECT AGENTS API
// ============================================

// Link agent to project
app.post("/api/projects/:id/agents", async (c) => {
  const db = c.env.DB;
  const projectId = c.req.param("id");
  const body = await c.req.json();
  const { agent_id, is_primary } = body;

  if (!agent_id) {
    return c.json({ error: "agent_id is required" }, 400);
  }

  const id = generateId();

  // If setting as primary, clear other primary flags
  if (is_primary) {
    await db
      .prepare("UPDATE project_agents SET is_primary = 0 WHERE project_id = ?")
      .bind(projectId)
      .run();
  }

  try {
    await db
      .prepare(
        `
        INSERT INTO project_agents (id, project_id, agent_id, is_primary)
        VALUES (?, ?, ?, ?)
      `,
      )
      .bind(id, projectId, agent_id, is_primary ? 1 : 0)
      .run();

    return c.json({ success: true, id }, 201);
  } catch (error) {
    if (error.message?.includes("UNIQUE constraint")) {
      return c.json({ error: "Agent already linked to project" }, 409);
    }
    throw error;
  }
});

// Remove agent from project
app.delete("/api/projects/:id/agents/:agentId", async (c) => {
  const db = c.env.DB;
  const projectId = c.req.param("id");
  const agentId = c.req.param("agentId");

  const result = await db
    .prepare("DELETE FROM project_agents WHERE project_id = ? AND agent_id = ?")
    .bind(projectId, agentId)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: "Agent link not found" }, 404);
  }

  return c.json({ success: true });
});

// ============================================
// PROJECT AI CONTEXT API
// ============================================

// ============================================
// PROJECT PROMPTS API
// ============================================

// Save a generated prompt to a project
app.post("/api/projects/:id/prompts", async (c) => {
  const db = c.env.DB;
  const projectId = c.req.param("id");
  const body = await c.req.json();
  const {
    prompt_content,
    prompt_type = "general",
    title,
    prompt_notes,
    agent_id,
    agent_name,
    context_used,
    constraints_used,
    output_format,
    output_requirements_id,
    output_requirements_content,
    enhancement_type,
    is_primary = 0,
  } = body;

  if (!prompt_content) {
    return c.json({ error: "prompt_content is required" }, 400);
  }

  // Verify project exists
  const project = await db
    .prepare("SELECT id FROM projects WHERE id = ?")
    .bind(projectId)
    .first();

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const id = generateId();

  await db
    .prepare(
      `INSERT INTO project_prompts
       (id, project_id, prompt_content, prompt_type, title, prompt_notes,
        agent_id, agent_name, context_used, constraints_used, output_format,
        output_requirements_id, output_requirements_content, enhancement_type, is_primary)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      projectId,
      prompt_content,
      prompt_type,
      title || null,
      prompt_notes || null,
      agent_id || null,
      agent_name || null,
      context_used || null,
      constraints_used || null,
      output_format || null,
      output_requirements_id || null,
      output_requirements_content || null,
      enhancement_type || null,
      is_primary,
    )
    .run();

  const savedPrompt = await db
    .prepare("SELECT * FROM project_prompts WHERE id = ?")
    .bind(id)
    .first();

  return c.json(savedPrompt, 201);
});

// Get all prompts for a project
app.get("/api/projects/:id/prompts", async (c) => {
  const db = c.env.DB;
  const projectId = c.req.param("id");
  const limit = parseInt(c.req.query("limit") || "50");
  const offset = parseInt(c.req.query("offset") || "0");

  const prompts = await db
    .prepare(
      `SELECT * FROM project_prompts
       WHERE project_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(projectId, limit, offset)
    .all();

  return c.json(prompts.results);
});

// Get a single prompt
app.get("/api/projects/:projectId/prompts/:promptId", async (c) => {
  const db = c.env.DB;
  const promptId = c.req.param("promptId");

  const prompt = await db
    .prepare("SELECT * FROM project_prompts WHERE id = ?")
    .bind(promptId)
    .first();

  if (!prompt) {
    return c.json({ error: "Prompt not found" }, 404);
  }

  return c.json(prompt);
});

// Update prompt feedback/usefulness
app.put("/api/projects/:projectId/prompts/:promptId", async (c) => {
  const db = c.env.DB;
  const promptId = c.req.param("promptId");
  const body = await c.req.json();

  const existing = await db
    .prepare("SELECT * FROM project_prompts WHERE id = ?")
    .bind(promptId)
    .first();

  if (!existing) {
    return c.json({ error: "Prompt not found" }, 404);
  }

  await db
    .prepare(
      `UPDATE project_prompts SET
        was_useful = ?, feedback = ?, prompt_notes = ?
       WHERE id = ?`,
    )
    .bind(
      body.was_useful !== undefined ? body.was_useful : existing.was_useful,
      body.feedback ?? existing.feedback,
      body.prompt_notes ?? existing.prompt_notes,
      promptId,
    )
    .run();

  const updated = await db
    .prepare("SELECT * FROM project_prompts WHERE id = ?")
    .bind(promptId)
    .first();

  return c.json(updated);
});

// Delete a prompt from project
app.delete("/api/projects/:projectId/prompts/:promptId", async (c) => {
  const db = c.env.DB;
  const promptId = c.req.param("promptId");

  const result = await db
    .prepare("DELETE FROM project_prompts WHERE id = ?")
    .bind(promptId)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: "Prompt not found" }, 404);
  }

  return c.json({ success: true });
});

// ============================================
// AI LEARNING FROM PROMPTS
// ============================================

// Learn from a prompt to update project context
app.post("/api/projects/:id/learn-from-prompt", async (c) => {
  const db = c.env.DB;
  const ai = c.env.AI;
  const projectId = c.req.param("id");
  const body = await c.req.json();
  const { prompt_content, task_description, context, agent_role } = body;

  if (!ai) {
    return c.json({ error: "AI binding not configured" }, 500);
  }

  // Get current project
  const project = await db
    .prepare("SELECT * FROM projects WHERE id = ?")
    .bind(projectId)
    .first();

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  try {
    // Use AI to extract insights from the prompt
    const response = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        {
          role: "system",
          content: `You are an AI assistant that analyzes prompts to extract useful project context.
Your job is to identify key information that would help future AI interactions with this project.
Extract:
1. Technologies, frameworks, or tools mentioned
2. Key requirements or constraints
3. Important context about the project's goals
4. Any patterns in how tasks should be approached

Return a JSON object with:
- context_update: A brief summary (1-2 sentences) to add to the project's AI context
- technologies: Array of technology names mentioned
- requirements: Array of key requirements inferred
- should_update: Boolean - true if there's meaningful new context to add`,
        },
        {
          role: "user",
          content: `Current project: ${project.name}
Current project context: ${project.ai_context_summary || "None"}
Current project info: ${project.project_info || "None"}

New prompt generated for this project:
Task: ${task_description}
Context provided: ${context || "None"}
Agent role used: ${agent_role || "None"}

Full prompt:
${prompt_content}

Analyze this and extract any new useful context for the project.`,
        },
      ],
      max_tokens: 1024,
      temperature: 0.3,
    });

    // Try to parse the AI response
    let insights;
    try {
      const jsonMatch = response.response.match(/\{[\s\S]*\}/);
      insights = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      insights = null;
    }

    if (insights && insights.should_update && insights.context_update) {
      // Save the insight for review
      const insightId = generateId();
      await db
        .prepare(
          `INSERT INTO project_ai_insights
           (id, project_id, insight_type, insight_content, confidence, status)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          insightId,
          projectId,
          "context_update",
          JSON.stringify(insights),
          0.7,
          "pending",
        )
        .run();

      // Optionally auto-update the project context (append to existing)
      const currentContext = project.ai_context_summary || "";
      const newContext = currentContext
        ? `${currentContext} ${insights.context_update}`
        : insights.context_update;

      // Only update if the new context adds value
      if (newContext.length > currentContext.length) {
        await db
          .prepare("UPDATE projects SET ai_context_summary = ? WHERE id = ?")
          .bind(newContext.substring(0, 500), projectId) // Limit context length
          .run();
      }

      return c.json({
        success: true,
        insights_extracted: true,
        context_updated: true,
        insights,
      });
    }

    return c.json({
      success: true,
      insights_extracted: false,
      message: "No significant new context detected",
    });
  } catch (error) {
    console.error("AI learning failed:", error);
    return c.json({
      success: false,
      error: "AI analysis failed",
      details: error.message,
    });
  }
});

// Get AI insights for a project
app.get("/api/projects/:id/ai-insights", async (c) => {
  const db = c.env.DB;
  const projectId = c.req.param("id");
  const status = c.req.query("status");

  let query = "SELECT * FROM project_ai_insights WHERE project_id = ?";
  const params = [projectId];

  if (status) {
    query += " AND status = ?";
    params.push(status);
  }

  query += " ORDER BY created_at DESC";

  const insights = await db
    .prepare(query)
    .bind(...params)
    .all();

  return c.json(insights.results);
});

// Update insight status (accept/reject)
app.put("/api/projects/:id/ai-insights/:insightId", async (c) => {
  const db = c.env.DB;
  const insightId = c.req.param("insightId");
  const body = await c.req.json();
  const { status } = body;

  if (!["pending", "accepted", "rejected", "applied"].includes(status)) {
    return c.json({ error: "Invalid status" }, 400);
  }

  await db
    .prepare(
      `UPDATE project_ai_insights
       SET status = ?, reviewed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(status, insightId)
    .run();

  const updated = await db
    .prepare("SELECT * FROM project_ai_insights WHERE id = ?")
    .bind(insightId)
    .first();

  return c.json(updated);
});

// ============================================
// PROJECT AI CONTEXT API
// ============================================

// Get AI context for all related projects (for cross-project awareness)
app.get("/api/projects/:id/ai-context", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  const project = await db
    .prepare("SELECT * FROM projects WHERE id = ?")
    .bind(id)
    .first();

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  // Get all related projects that are included in AI context
  const relatedProjects = await db
    .prepare(
      `
      SELECT p.id, p.name, p.slug, p.ai_context_summary, p.description, pr.relationship_type
      FROM project_relationships pr
      JOIN projects p ON p.id = pr.related_project_id
      WHERE pr.source_project_id = ? AND p.include_in_ai_context = 1
    `,
    )
    .bind(id)
    .all();

  // Build AI context summary
  const context = {
    currentProject: {
      id: project.id,
      name: project.name,
      slug: project.slug,
      description: project.description,
      ai_context_summary: project.ai_context_summary,
      project_info: project.project_info,
    },
    relatedProjects: relatedProjects.results.map((rp) => ({
      name: rp.name,
      slug: rp.slug,
      relationship: rp.relationship_type,
      context: rp.ai_context_summary || rp.description,
    })),
    contextPrompt: `You are working on the project "${project.name}". ${project.ai_context_summary || project.description || ""}
${
  relatedProjects.results.length > 0
    ? `
This project has relationships with:
${relatedProjects.results.map((rp) => `- ${rp.name} (${rp.relationship_type}): ${rp.ai_context_summary || rp.description || "No description"}`).join("\n")}

When making changes, consider how they might affect these related projects.`
    : ""
}`,
  };

  return c.json(context);
});

// ============================================
// STATIC ASSETS HANDLER (CLEAN URLs)
// ============================================

// Root URL: / -> index.html (prompt builder)
app.get("/", async (c) => {
  const htmlRequest = new Request(new URL("/index.html", c.req.url).toString());
  const response = await c.env.ASSETS.fetch(htmlRequest);
  const newResponse = new Response(response.body, response);
  newResponse.headers.set(
    "Cache-Control",
    "public, max-age=0, must-revalidate",
  );
  return newResponse;
});

// Clean URL: /projects -> projects.html
app.get("/projects", async (c) => {
  const htmlRequest = new Request(
    new URL("/projects.html", c.req.url).toString(),
  );
  const response = await c.env.ASSETS.fetch(htmlRequest);
  const newResponse = new Response(response.body, response);
  newResponse.headers.set(
    "Cache-Control",
    "public, max-age=0, must-revalidate",
  );
  return newResponse;
});

// Clean URL: /project/:slug -> project.html (with slug parsing)
app.get("/project/:slug", async (c) => {
  try {
    const projectHtmlRequest = new Request(
      new URL("/project.html", c.req.url).toString(),
    );
    const response = await c.env.ASSETS.fetch(projectHtmlRequest);
    const newResponse = new Response(response.body, response);
    newResponse.headers.set(
      "Cache-Control",
      "public, max-age=0, must-revalidate",
    );
    return newResponse;
  } catch (error) {
    console.error("Error serving project page:", error);
    return c.text("Error loading project page: " + error.message, 500);
  }
});

// Clean URL: /builder -> index.html (prompt builder)
app.get("/builder", async (c) => {
  const htmlRequest = new Request(new URL("/index.html", c.req.url).toString());
  const response = await c.env.ASSETS.fetch(htmlRequest);
  const newResponse = new Response(response.body, response);
  newResponse.headers.set(
    "Cache-Control",
    "public, max-age=0, must-revalidate",
  );
  return newResponse;
});

// Serve static assets for non-API routes
app.get("*", async (c) => {
  const url = new URL(c.req.url);
  const path = url.pathname;

  // Let the asset binding handle static file serving
  const response = await c.env.ASSETS.fetch(c.req.raw);

  // Clone response to modify headers
  const newResponse = new Response(response.body, response);

  // Set cache headers for static assets
  if (path.match(/\.(js|css|svg|png|jpg|jpeg|gif|ico|woff|woff2)$/)) {
    newResponse.headers.set(
      "Cache-Control",
      "public, max-age=31536000, immutable",
    );
  } else if (path === "/" || path.endsWith(".html")) {
    newResponse.headers.set(
      "Cache-Control",
      "public, max-age=0, must-revalidate",
    );
  }

  return newResponse;
});

export default app;
