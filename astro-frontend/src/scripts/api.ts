import type { 
  Agent, 
  OutputRequirement, 
  Project, 
  ProjectResource, 
  AvailableResource,
  GeneratedPrompt,
  ExportConfig,
  AISuggestion,
  RuleSet,
  Hook,
  APIClientConfig,
  RequestOptions
} from '../types';
import { handleAPIError } from './error-handler';

/**
 * Enhanced error classes for better error handling
 */
export class APIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }

  static fromResponse(response: Response, data?: any): APIError {
    const message = data?.error || data?.message || `HTTP ${response.status}: ${response.statusText}`;
    return new APIError(message, response.status, data?.code, data);
  }
}

export class NetworkError extends APIError {
  constructor(message: string = 'Network request failed') {
    super(message, 0, 'NETWORK_ERROR');
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends APIError {
  constructor(timeout: number) {
    super(`Request timeout after ${timeout}ms`, 0, 'TIMEOUT_ERROR');
    this.name = 'TimeoutError';
  }
}

/**
 * API Client for Semantic Prompt Workstation
 * Provides type-safe methods for communicating with the backend
 * Enhanced with comprehensive error handling and retry logic
 */
export class APIClient {
  private baseURL: string;
  private timeout: number;
  private retryAttempts: number;
  private retryDelay: number;

  constructor(config: Partial<APIClientConfig> = {}) {
    this.baseURL = config.baseURL || '/api';
    this.timeout = config.timeout || 10000;
    this.retryAttempts = config.retryAttempts || 3;
    this.retryDelay = config.retryDelay || 1000;
  }

  /**
   * Generic request method with enhanced error handling, retry logic, and type safety
   */
  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const url = `${this.baseURL}${endpoint}`;
        console.log('API Request:', url);
        
        const response = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            ...options.headers
          },
          signal: controller.signal,
          ...options
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const apiError = APIError.fromResponse(response, errorData);
          
          // Don't retry on client errors (4xx) except 408, 429
          if (response.status >= 400 && response.status < 500 && 
              response.status !== 408 && response.status !== 429) {
            throw apiError;
          }
          
          lastError = apiError;
        } else {
          // Success - parse and return response
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            return await response.json();
          } else {
            return response.text() as unknown as T;
          }
        }
      } catch (error) {
        clearTimeout(timeoutId);
        
        if (error instanceof APIError) {
          lastError = error;
        } else if (error instanceof Error) {
          if (error.name === 'AbortError') {
            lastError = new TimeoutError(this.timeout);
          } else if (error instanceof TypeError || error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
            lastError = new NetworkError(error.message);
          } else {
            lastError = new APIError(error.message, 0, 'UNKNOWN_ERROR');
          }
        } else {
          lastError = new APIError('Unknown error occurred', 0, 'UNKNOWN_ERROR');
        }
      }

      // Wait before retry (exponential backoff)
      if (attempt < this.retryAttempts) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * Math.pow(2, attempt)));
      }
    }

    throw lastError || new APIError('Request failed after all retry attempts');
  }

  /**
   * Health check endpoint to verify API connectivity
   */
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    try {
      return await this.request<{ status: string; timestamp: string }>('/health');
    } catch (error) {
      // Fallback health check
      return { status: 'unknown', timestamp: new Date().toISOString() };
    }
  }

  // Agent Management
  async getAgents(): Promise<Agent[]> {
    try {
      return await this.request<Agent[]>('/agents');
    } catch (error) {
      handleAPIError(error as Error, 'get_agents', 'APIClient');
      throw error;
    }
  }

  async createAgent(agent: Omit<Agent, 'id' | 'created' | 'updated'>): Promise<Agent> {
    try {
      return await this.request<Agent>('/agents', {
        method: 'POST',
        body: JSON.stringify(agent)
      });
    } catch (error) {
      handleAPIError(error as Error, 'create_agent', 'APIClient');
      throw error;
    }
  }

  async updateAgent(id: string, agent: Partial<Agent>): Promise<Agent> {
    return this.request<Agent>(`/agents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(agent)
    });
  }

  async deleteAgent(id: string): Promise<void> {
    await this.request(`/agents/${id}`, { method: 'DELETE' });
  }

  // Rule Sets Management
  async getRuleSets(): Promise<RuleSet[]> {
    return this.request<RuleSet[]>('/rules');
  }

  async createRuleSet(ruleSet: Omit<RuleSet, 'id' | 'created_at' | 'updated_at'>): Promise<RuleSet> {
    return this.request<RuleSet>('/rules', {
      method: 'POST',
      body: JSON.stringify(ruleSet)
    });
  }

  async updateRuleSet(id: string, ruleSet: Partial<RuleSet>): Promise<RuleSet> {
    return this.request<RuleSet>(`/rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(ruleSet)
    });
  }

  async deleteRuleSet(id: string): Promise<void> {
    await this.request(`/rules/${id}`, { method: 'DELETE' });
  }

  async enhanceRules(id: string, config: { context?: string; goals: string[] }): Promise<{ enhanced_content: string }> {
    return this.request<{ enhanced_content: string }>(`/ai/enhance-rules/${id}`, {
      method: 'POST',
      body: JSON.stringify(config)
    });
  }

  // Hooks Management
  async getHooks(): Promise<Hook[]> {
    return this.request<Hook[]>('/hooks');
  }

  async createHook(hook: Omit<Hook, 'id' | 'created_at' | 'updated_at'>): Promise<Hook> {
    return this.request<Hook>('/hooks', {
      method: 'POST',
      body: JSON.stringify(hook)
    });
  }

  async updateHook(id: string, hook: Partial<Hook>): Promise<Hook> {
    return this.request<Hook>(`/hooks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(hook)
    });
  }

  async deleteHook(id: string): Promise<void> {
    await this.request(`/hooks/${id}`, { method: 'DELETE' });
  }

  async testHook(id: string, context?: any): Promise<{ result: any; logs: string[] }> {
    return this.request<{ result: any; logs: string[] }>(`/hooks/${id}/test`, {
      method: 'POST',
      body: JSON.stringify({ context })
    });
  }

  // Output Requirements Management
  async getOutputRequirements(): Promise<OutputRequirement[]> {
    return this.request<OutputRequirement[]>('/output-requirements');
  }

  async createOutputRequirement(requirement: Omit<OutputRequirement, 'id' | 'created' | 'updated'>): Promise<OutputRequirement> {
    return this.request<OutputRequirement>('/output-requirements', {
      method: 'POST',
      body: JSON.stringify(requirement)
    });
  }

  async updateOutputRequirement(id: string, requirement: Partial<OutputRequirement>): Promise<OutputRequirement> {
    return this.request<OutputRequirement>(`/output-requirements/${id}`, {
      method: 'PUT',
      body: JSON.stringify(requirement)
    });
  }

  async deleteOutputRequirement(id: string): Promise<void> {
    await this.request(`/output-requirements/${id}`, { method: 'DELETE' });
  }

  async trackRequirementUsage(id: string): Promise<void> {
    await this.request(`/output-requirements/${id}/use`, { method: 'POST' });
  }

  // Project Management
  async getProjects(): Promise<{ projects: Project[] }> {
    return this.request<{ projects: Project[] }>('/projects');
  }

  async getProject(id: string): Promise<Project> {
    return this.request<Project>(`/projects/${id}`);
  }

  async getProjectResources(projectId: string): Promise<ProjectResource[]> {
    return this.request<ProjectResource[]>(`/projects/${projectId}/resources`);
  }

  async assignResourceToProject(projectId: string, resourceId: string, resourceType: string): Promise<void> {
    await this.request(`/projects/${projectId}/resources`, {
      method: 'POST',
      body: JSON.stringify({ resourceId, resourceType })
    });
  }

  async unassignResourceFromProject(projectId: string, assignmentId: string): Promise<void> {
    await this.request(`/projects/${projectId}/resources/${assignmentId}`, {
      method: 'DELETE'
    });
  }

  async getAvailableResources(projectId: string): Promise<AvailableResource[]> {
    return this.request<AvailableResource[]>(`/projects/${projectId}/available-resources`);
  }

  async importResourcesToProject(projectId: string, resources: { resourceId: string; resourceType: string }[]): Promise<void> {
    await this.request(`/projects/${projectId}/import`, {
      method: 'POST',
      body: JSON.stringify({ resources })
    });
  }

  // Prompt Generation
  async generatePromptFromTemplate(projectId: string, config: {
    agentId: string;
    task: string;
    context: string;
    format: string;
    outputRequirements: string;
  }): Promise<{ prompt: string }> {
    return this.request<{ prompt: string }>(`/projects/${projectId}/generate-from-template`, {
      method: 'POST',
      body: JSON.stringify(config)
    });
  }

  async savePromptToProject(projectId: string, prompt: GeneratedPrompt): Promise<void> {
    await this.request(`/projects/${projectId}/prompts`, {
      method: 'POST',
      body: JSON.stringify(prompt)
    });
  }

  async createProject(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>): Promise<Project> {
    return this.request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(project)
    });
  }

  async updateProject(id: string, project: Partial<Project>): Promise<Project> {
    return this.request<Project>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(project)
    });
  }

  async deleteProject(id: string): Promise<void> {
    await this.request(`/projects/${id}`, { method: 'DELETE' });
  }

  // AI Enhancement
  async getAISuggestions(projectId: string, context: {
    task: string;
    context: string;
    agent?: Agent;
  }): Promise<AISuggestion> {
    return this.request<AISuggestion>('/ai/enhance-resource', {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        resourceType: 'prompt',
        context
      })
    });
  }

  // Export Functionality
  async exportProject(projectId: string, config: ExportConfig): Promise<{ downloadUrl: string }> {
    return this.request<{ downloadUrl: string }>(`/export/claude-code/${projectId}`, {
      method: 'POST',
      body: JSON.stringify(config)
    });
  }
}

// Create singleton instance
export const apiClient = new APIClient();

// Convenience functions for common operations
export const api = {
  // Agents
  agents: {
    list: () => apiClient.getAgents(),
    create: (agent: Omit<Agent, 'id' | 'created' | 'updated'>) => apiClient.createAgent(agent),
    update: (id: string, agent: Partial<Agent>) => apiClient.updateAgent(id, agent),
    delete: (id: string) => apiClient.deleteAgent(id)
  },

  // Output Requirements
  requirements: {
    list: () => apiClient.getOutputRequirements(),
    create: (req: Omit<OutputRequirement, 'id' | 'created' | 'updated'>) => apiClient.createOutputRequirement(req),
    update: (id: string, req: Partial<OutputRequirement>) => apiClient.updateOutputRequirement(id, req),
    delete: (id: string) => apiClient.deleteOutputRequirement(id),
    trackUsage: (id: string) => apiClient.trackRequirementUsage(id)
  },

  // Projects
  projects: {
    list: () => apiClient.getProjects(),
    get: (id: string) => apiClient.getProject(id),
    create: (project: Omit<Project, 'id' | 'created_at' | 'updated_at'>) => apiClient.createProject(project),
    update: (id: string, project: Partial<Project>) => apiClient.updateProject(id, project),
    delete: (id: string) => apiClient.deleteProject(id),
    resources: (id: string) => apiClient.getProjectResources(id),
    assignResource: (projectId: string, resourceId: string, resourceType: string) => 
      apiClient.assignResourceToProject(projectId, resourceId, resourceType),
    unassignResource: (projectId: string, assignmentId: string) => 
      apiClient.unassignResourceFromProject(projectId, assignmentId),
    availableResources: (id: string) => apiClient.getAvailableResources(id),
    importResources: (projectId: string, resources: { resourceId: string; resourceType: string }[]) =>
      apiClient.importResourcesToProject(projectId, resources)
  },

  // Rules
  rules: {
    list: () => apiClient.getRuleSets(),
    create: (ruleSet: Omit<RuleSet, 'id' | 'created_at' | 'updated_at'>) => apiClient.createRuleSet(ruleSet),
    update: (id: string, ruleSet: Partial<RuleSet>) => apiClient.updateRuleSet(id, ruleSet),
    delete: (id: string) => apiClient.deleteRuleSet(id)
  },

  // Hooks
  hooks: {
    list: () => apiClient.getHooks(),
    create: (hook: Omit<Hook, 'id' | 'created_at' | 'updated_at'>) => apiClient.createHook(hook),
    update: (id: string, hook: Partial<Hook>) => apiClient.updateHook(id, hook),
    delete: (id: string) => apiClient.deleteHook(id),
    test: (id: string, context?: any) => apiClient.testHook(id, context)
  },

  // Prompts
  prompts: {
    generate: (projectId: string, config: any) => apiClient.generatePromptFromTemplate(projectId, config),
    save: (projectId: string, prompt: GeneratedPrompt) => apiClient.savePromptToProject(projectId, prompt)
  },

  // AI
  ai: {
    getSuggestions: (projectId: string, context: any) => apiClient.getAISuggestions(projectId, context),
    enhanceRules: (id: string, config: { context?: string; goals: string[] }) => apiClient.enhanceRules(id, config)
  },

  // Export
  export: {
    project: (projectId: string, config: ExportConfig) => apiClient.exportProject(projectId, config)
  }
};

export default apiClient;