// Core data model interfaces for the Semantic Prompt Workstation

export interface Agent {
  id: string;
  name: string;
  display_name?: string;
  prompt_content: string; // Main agent prompt/role description
  description?: string;
  agent_config?: string; // JSON string with allowed tools etc
  icon?: string;
  category?: string;
  is_enabled?: boolean | number;
  project_id?: string;
  created_at?: string;
  updated_at?: string;
  // Legacy field for backwards compatibility
  role?: string;
  style?: string;
}

export interface Theme {
  id: string;
  name: string;
  colors: Record<string, string>;
  fonts: {
    primary: string;
    secondary: string;
    mono: string;
  };
  created?: Date;
  updated?: Date;
}

export interface PromptConfig {
  agent: Agent;
  task: string;
  context: string;
  constraints: string[];
  outputFormat: string;
  outputRequirements?: string;
}

export interface OutputRequirement {
  id: string;
  name: string;
  description?: string;
  requirements_content: string;
  usage_count?: number;
  created?: Date;
  updated?: Date;
}

export interface Project {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  context?: string;
  status?: "active" | "archived" | "draft";
  ai_context_summary?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RuleSet {
  id: string;
  name: string;
  description?: string;
  rule_content: string;
  ide_id?: string;
  agent_id?: string;
  category?: string;
  priority?: number;
  tags?: string;
  is_active?: number;
  ai_enhanced?: boolean;
  usage_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Hook {
  id: string;
  name: string;
  description?: string;
  category: "workflow" | "integration" | "automation";
  trigger:
    | "manual"
    | "file_save"
    | "project_create"
    | "agent_create"
    | "prompt_generate"
    | "schedule";
  action:
    | "generate_prompt"
    | "run_command"
    | "send_webhook"
    | "create_file"
    | "update_project";
  trigger_config?: Record<string, any>;
  action_config?: Record<string, any>;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProjectResource {
  id: string;
  project_id: string;
  resource_id: string;
  resource_type: "agent" | "rule" | "hook" | "prompt";
  assigned_at?: Date;
}

export interface AvailableResource {
  id: string;
  name: string;
  type: "agent" | "rule" | "hook";
  description?: string;
  role?: string;
}

export interface GeneratedPrompt {
  content: string;
  agentId?: string;
  projectId?: string;
  context: {
    task: string;
    context: string;
    format: string;
    requirements: string;
  };
  created?: Date;
}

export interface ExportConfig {
  format: "claude-code" | "json" | "zip";
  filename: string;
  include: {
    agents: boolean;
    rules: boolean;
    hooks: boolean;
    prompts: boolean;
  };
}

export interface AISuggestion {
  suggestions: string[];
  contextualTips?: string;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// UI State interfaces
export interface UIState {
  selectedAgentId: string | null;
  selectedRequirementId: string | null;
  currentProjectId: string | null;
  sidebarOpen: boolean;
  activeView: "builder" | "output";
  syncStatus: "synced" | "syncing" | "error";
}

export interface ToastMessage {
  id?: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
  duration?: number;
  action?: {
    label: string;
    handler: () => void;
  };
}

// Component Props interfaces
export interface CollapsibleSectionProps {
  id: string;
  title: string;
  count?: number;
  collapsed?: boolean;
  onAdd?: () => void;
  addButtonTitle?: string;
}

export interface ItemCardProps {
  id: string;
  name: string;
  preview: string;
  active?: boolean;
  onSelect?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  showProjectActions?: boolean;
}

export interface SelectionTagProps {
  name: string;
  status: string;
  hasSelection?: boolean;
  onClear?: () => void;
}

// API Client types
export interface APIClientConfig {
  baseURL?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface RequestOptions extends RequestInit {
  timeout?: number;
}

// Form validation types
export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
}

export interface FormField {
  name: string;
  value: any;
  rules?: ValidationRule[];
  error?: string;
}

export interface FormState {
  fields: Record<string, FormField>;
  isValid: boolean;
  isSubmitting: boolean;
}

// Progress tracking types
export interface ProgressStep {
  id: string;
  label: string;
  status: "pending" | "active" | "completed" | "error";
}

export interface ProgressState {
  steps: ProgressStep[];
  currentStep: number;
  percentage: number;
  message?: string;
}
