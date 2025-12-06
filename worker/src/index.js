/**
 * Semantic Prompt Workstation - Cloudflare Worker with Hono
 * Serves static assets and provides API endpoints for D1 database operations
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
  const { name, role, style, description } = body;

  if (!name || !role) {
    return c.json({ error: "Name and role are required" }, 400);
  }

  const id = generateId();
  await db
    .prepare(
      "INSERT INTO agents (id, name, role, style, description) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(id, name, role, style || "", description || "")
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
       SET name = ?, role = ?, style = ?, description = ?, is_active = ?
       WHERE id = ?`,
    )
    .bind(
      body.name ?? existing.name,
      body.role ?? existing.role,
      body.style ?? existing.style,
      body.description ?? existing.description,
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
           status = ?, estimated_effort = ?, depends_on = ?, output_notes = ?, completed_at = ?
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
      id,
    )
    .run();

  const step = await db
    .prepare("SELECT * FROM plan_steps WHERE id = ?")
    .bind(id)
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
// STATIC ASSETS HANDLER
// ============================================

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
