import type { 
  Agent, 
  OutputRequirement, 
  Project, 
  UIState, 
  ToastMessage,
  ProgressState 
} from '../types';
import { cache, uiState } from './storage';

/**
 * Global State Management System for Astro
 * Implements reactive state management with localStorage persistence
 * and error recovery capabilities
 */

export type StateChangeListener<T = any> = (newState: T, oldState: T) => void;
export type ErrorHandler = (error: Error, context: string) => void;

/**
 * Base reactive state class with event emission
 */
class ReactiveState<T> {
  private _state: T;
  private listeners: Set<StateChangeListener<T>> = new Set();
  private errorHandlers: Set<ErrorHandler> = new Set();

  constructor(initialState: T) {
    this._state = initialState;
  }

  get state(): T {
    return this._state;
  }

  setState(newState: Partial<T> | ((prevState: T) => T)): void {
    try {
      const oldState = { ...this._state };
      
      if (typeof newState === 'function') {
        this._state = newState(this._state);
      } else {
        this._state = { ...this._state, ...newState };
      }

      // Notify all listeners
      this.listeners.forEach(listener => {
        try {
          listener(this._state, oldState);
        } catch (error) {
          this.handleError(error as Error, 'state_listener');
        }
      });
    } catch (error) {
      this.handleError(error as Error, 'state_update');
    }
  }

  subscribe(listener: StateChangeListener<T>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  private handleError(error: Error, context: string): void {
    this.errorHandlers.forEach(handler => {
      try {
        handler(error, context);
      } catch (handlerError) {
        console.error('Error in error handler:', handlerError);
      }
    });
    
    if (this.errorHandlers.size === 0) {
      console.error(`State error in ${context}:`, error);
    }
  }
}

/**
 * Application State Interface
 */
export interface AppState {
  // Data states
  agents: Agent[];
  outputRequirements: OutputRequirement[];
  projects: Project[];
  
  // UI states
  ui: UIState;
  
  // Loading states
  loading: {
    agents: boolean;
    requirements: boolean;
    projects: boolean;
    saving: boolean;
  };
  
  // Error states
  errors: {
    agents: string | null;
    requirements: string | null;
    projects: string | null;
    network: string | null;
  };
  
  // Toast notifications
  toasts: ToastMessage[];
  
  // Progress tracking
  progress: ProgressState | null;
  
  // Sync status
  sync: {
    lastSync: Date | null;
    status: 'idle' | 'syncing' | 'error';
    pendingChanges: number;
  };
}

/**
 * Initial application state
 */
const initialAppState: AppState = {
  agents: [],
  outputRequirements: [],
  projects: [],
  ui: {
    selectedAgentId: null,
    selectedRequirementId: null,
    currentProjectId: null,
    sidebarOpen: false,
    activeView: 'builder',
    syncStatus: 'synced'
  },
  loading: {
    agents: false,
    requirements: false,
    projects: false,
    saving: false
  },
  errors: {
    agents: null,
    requirements: null,
    projects: null,
    network: null
  },
  toasts: [],
  progress: null,
  sync: {
    lastSync: null,
    status: 'idle',
    pendingChanges: 0
  }
};

/**
 * Global application state instance
 */
export class AppStateManager extends ReactiveState<AppState> {
  private persistenceEnabled: boolean = true;
  private autoSaveTimeout: number | null = null;

  constructor() {
    super(initialAppState);
    this.loadPersistedState();
    this.setupAutoSave();
  }

  /**
   * Load persisted state from localStorage
   */
  private loadPersistedState(): void {
    try {
      const persistedUI = uiState.load();
      this.setState(prevState => ({
        ...prevState,
        ui: { ...prevState.ui, ...persistedUI }
      }));

      // Load cached data
      const cachedAgents = cache.get<Agent[]>('agents');
      const cachedRequirements = cache.get<OutputRequirement[]>('requirements');
      const cachedProjects = cache.get<Project[]>('projects');

      if (cachedAgents) this.setState(prev => ({ ...prev, agents: cachedAgents }));
      if (cachedRequirements) this.setState(prev => ({ ...prev, outputRequirements: cachedRequirements }));
      if (cachedProjects) this.setState(prev => ({ ...prev, projects: cachedProjects }));
    } catch (error) {
      this.handleError(error as Error, 'load_persisted_state');
    }
  }

  /**
   * Setup automatic state persistence
   */
  private setupAutoSave(): void {
    this.subscribe((newState) => {
      if (!this.persistenceEnabled) return;

      // Debounce auto-save
      if (this.autoSaveTimeout) {
        clearTimeout(this.autoSaveTimeout);
      }

      this.autoSaveTimeout = window.setTimeout(() => {
        this.persistState(newState);
      }, 500);
    });
  }

  /**
   * Persist state to localStorage
   */
  private persistState(state: AppState): void {
    try {
      // Persist UI state
      uiState.save(state.ui);

      // Cache data with TTL
      cache.set('agents', state.agents, 10 * 60 * 1000); // 10 minutes
      cache.set('requirements', state.outputRequirements, 10 * 60 * 1000);
      cache.set('projects', state.projects, 10 * 60 * 1000);
    } catch (error) {
      this.handleError(error as Error, 'persist_state');
    }
  }

  /**
   * Action creators for state updates
   */
  
  // Agent actions
  setAgents(agents: Agent[]): void {
    this.setState(prev => ({ 
      ...prev, 
      agents,
      errors: { ...prev.errors, agents: null }
    }));
  }

  addAgent(agent: Agent): void {
    this.setState(prev => ({
      ...prev,
      agents: [...prev.agents, agent]
    }));
  }

  updateAgent(id: string, updates: Partial<Agent>): void {
    this.setState(prev => ({
      ...prev,
      agents: prev.agents.map(agent => 
        agent.id === id ? { ...agent, ...updates } : agent
      )
    }));
  }

  removeAgent(id: string): void {
    this.setState(prev => ({
      ...prev,
      agents: prev.agents.filter(agent => agent.id !== id),
      ui: prev.ui.selectedAgentId === id 
        ? { ...prev.ui, selectedAgentId: null }
        : prev.ui
    }));
  }

  // Output Requirements actions
  setOutputRequirements(requirements: OutputRequirement[]): void {
    this.setState(prev => ({ 
      ...prev, 
      outputRequirements: requirements,
      errors: { ...prev.errors, requirements: null }
    }));
  }

  addOutputRequirement(requirement: OutputRequirement): void {
    this.setState(prev => ({
      ...prev,
      outputRequirements: [...prev.outputRequirements, requirement]
    }));
  }

  updateOutputRequirement(id: string, updates: Partial<OutputRequirement>): void {
    this.setState(prev => ({
      ...prev,
      outputRequirements: prev.outputRequirements.map(req => 
        req.id === id ? { ...req, ...updates } : req
      )
    }));
  }

  removeOutputRequirement(id: string): void {
    this.setState(prev => ({
      ...prev,
      outputRequirements: prev.outputRequirements.filter(req => req.id !== id),
      ui: prev.ui.selectedRequirementId === id 
        ? { ...prev.ui, selectedRequirementId: null }
        : prev.ui
    }));
  }

  // Project actions
  setProjects(projects: Project[]): void {
    this.setState(prev => ({ 
      ...prev, 
      projects,
      errors: { ...prev.errors, projects: null }
    }));
  }

  addProject(project: Project): void {
    this.setState(prev => ({
      ...prev,
      projects: [...prev.projects, project]
    }));
  }

  updateProject(id: string, updates: Partial<Project>): void {
    this.setState(prev => ({
      ...prev,
      projects: prev.projects.map(project => 
        project.id === id ? { ...project, ...updates } : project
      )
    }));
  }

  removeProject(id: string): void {
    this.setState(prev => ({
      ...prev,
      projects: prev.projects.filter(project => project.id !== id),
      ui: prev.ui.currentProjectId === id 
        ? { ...prev.ui, currentProjectId: null }
        : prev.ui
    }));
  }

  // UI actions
  setSelectedAgent(agentId: string | null): void {
    this.setState(prev => ({
      ...prev,
      ui: { ...prev.ui, selectedAgentId: agentId }
    }));
  }

  setSelectedRequirement(requirementId: string | null): void {
    this.setState(prev => ({
      ...prev,
      ui: { ...prev.ui, selectedRequirementId: requirementId }
    }));
  }

  setCurrentProject(projectId: string | null): void {
    this.setState(prev => ({
      ...prev,
      ui: { ...prev.ui, currentProjectId: projectId }
    }));
  }

  setSidebarOpen(open: boolean): void {
    this.setState(prev => ({
      ...prev,
      ui: { ...prev.ui, sidebarOpen: open }
    }));
  }

  setActiveView(view: 'builder' | 'output'): void {
    this.setState(prev => ({
      ...prev,
      ui: { ...prev.ui, activeView: view }
    }));
  }

  // Loading actions
  setLoading(key: keyof AppState['loading'], loading: boolean): void {
    this.setState(prev => ({
      ...prev,
      loading: { ...prev.loading, [key]: loading }
    }));
  }

  // Error actions
  setError(key: keyof AppState['errors'], error: string | null): void {
    this.setState(prev => ({
      ...prev,
      errors: { ...prev.errors, [key]: error }
    }));
  }

  clearErrors(): void {
    this.setState(prev => ({
      ...prev,
      errors: {
        agents: null,
        requirements: null,
        projects: null,
        network: null
      }
    }));
  }

  // Toast actions
  addToast(toast: ToastMessage): void {
    const id = Date.now().toString();
    const toastWithId = { ...toast, id };
    
    this.setState(prev => ({
      ...prev,
      toasts: [...prev.toasts, toastWithId]
    }));

    // Auto-remove toast after duration
    const duration = toast.duration || 5000;
    setTimeout(() => {
      this.removeToast(id);
    }, duration);
  }

  removeToast(id: string): void {
    this.setState(prev => ({
      ...prev,
      toasts: prev.toasts.filter(toast => (toast as any).id !== id)
    }));
  }

  clearToasts(): void {
    this.setState(prev => ({ ...prev, toasts: [] }));
  }

  // Progress actions
  setProgress(progress: ProgressState | null): void {
    this.setState(prev => ({ ...prev, progress }));
  }

  // Sync actions
  setSyncStatus(status: 'idle' | 'syncing' | 'error'): void {
    this.setState(prev => ({
      ...prev,
      sync: { 
        ...prev.sync, 
        status,
        lastSync: status === 'idle' ? new Date() : prev.sync.lastSync
      }
    }));
  }

  incrementPendingChanges(): void {
    this.setState(prev => ({
      ...prev,
      sync: { ...prev.sync, pendingChanges: prev.sync.pendingChanges + 1 }
    }));
  }

  decrementPendingChanges(): void {
    this.setState(prev => ({
      ...prev,
      sync: { 
        ...prev.sync, 
        pendingChanges: Math.max(0, prev.sync.pendingChanges - 1)
      }
    }));
  }

  resetPendingChanges(): void {
    this.setState(prev => ({
      ...prev,
      sync: { ...prev.sync, pendingChanges: 0 }
    }));
  }

  /**
   * Utility methods
   */
  
  // Get selected items
  getSelectedAgent(): Agent | null {
    const { agents, ui } = this.state;
    return agents.find(agent => agent.id === ui.selectedAgentId) || null;
  }

  getSelectedRequirement(): OutputRequirement | null {
    const { outputRequirements, ui } = this.state;
    return outputRequirements.find(req => req.id === ui.selectedRequirementId) || null;
  }

  getCurrentProject(): Project | null {
    const { projects, ui } = this.state;
    return projects.find(project => project.id === ui.currentProjectId) || null;
  }

  // Check if data is loading
  isLoading(): boolean {
    const { loading } = this.state;
    return Object.values(loading).some(Boolean);
  }

  // Check if there are any errors
  hasErrors(): boolean {
    const { errors } = this.state;
    return Object.values(errors).some(error => error !== null);
  }

  // Get all errors
  getAllErrors(): string[] {
    const { errors } = this.state;
    return Object.values(errors).filter(error => error !== null) as string[];
  }

  /**
   * Reset state to initial values
   */
  reset(): void {
    this.setState(initialAppState);
  }

  /**
   * Enable/disable persistence
   */
  setPersistenceEnabled(enabled: boolean): void {
    this.persistenceEnabled = enabled;
  }
}

// Create singleton instance
export const appState = new AppStateManager();

// Export convenience hooks for common operations
export const useAppState = () => appState.state;
export const useSelectedAgent = () => appState.getSelectedAgent();
export const useSelectedRequirement = () => appState.getSelectedRequirement();
export const useCurrentProject = () => appState.getCurrentProject();

// Export action creators
export const actions = {
  // Agent actions
  setAgents: (agents: Agent[]) => appState.setAgents(agents),
  addAgent: (agent: Agent) => appState.addAgent(agent),
  updateAgent: (id: string, updates: Partial<Agent>) => appState.updateAgent(id, updates),
  removeAgent: (id: string) => appState.removeAgent(id),
  
  // Output Requirements actions
  setOutputRequirements: (requirements: OutputRequirement[]) => appState.setOutputRequirements(requirements),
  addOutputRequirement: (requirement: OutputRequirement) => appState.addOutputRequirement(requirement),
  updateOutputRequirement: (id: string, updates: Partial<OutputRequirement>) => appState.updateOutputRequirement(id, updates),
  removeOutputRequirement: (id: string) => appState.removeOutputRequirement(id),
  
  // Project actions
  setProjects: (projects: Project[]) => appState.setProjects(projects),
  addProject: (project: Project) => appState.addProject(project),
  updateProject: (id: string, updates: Partial<Project>) => appState.updateProject(id, updates),
  removeProject: (id: string) => appState.removeProject(id),
  
  // UI actions
  setSelectedAgent: (agentId: string | null) => appState.setSelectedAgent(agentId),
  setSelectedRequirement: (requirementId: string | null) => appState.setSelectedRequirement(requirementId),
  setCurrentProject: (projectId: string | null) => appState.setCurrentProject(projectId),
  setSidebarOpen: (open: boolean) => appState.setSidebarOpen(open),
  setActiveView: (view: 'builder' | 'output') => appState.setActiveView(view),
  
  // Loading actions
  setLoading: (key: keyof AppState['loading'], loading: boolean) => appState.setLoading(key, loading),
  
  // Error actions
  setError: (key: keyof AppState['errors'], error: string | null) => appState.setError(key, error),
  clearErrors: () => appState.clearErrors(),
  
  // Toast actions
  addToast: (toast: ToastMessage) => appState.addToast(toast),
  removeToast: (id: string) => appState.removeToast(id),
  clearToasts: () => appState.clearToasts(),
  
  // Progress actions
  setProgress: (progress: ProgressState | null) => appState.setProgress(progress),
  
  // Sync actions
  setSyncStatus: (status: 'idle' | 'syncing' | 'error') => appState.setSyncStatus(status),
  incrementPendingChanges: () => appState.incrementPendingChanges(),
  decrementPendingChanges: () => appState.decrementPendingChanges(),
  resetPendingChanges: () => appState.resetPendingChanges()
};

export default appState;