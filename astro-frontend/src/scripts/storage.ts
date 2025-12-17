import type { Agent, OutputRequirement, Project, UIState } from '../types';

/**
 * localStorage utilities for client-side persistence
 * Provides type-safe storage operations with error handling
 */

const STORAGE_KEYS = {
  UI_STATE: 'prompt_workstation_ui_state',
  SELECTED_AGENT: 'prompt_workstation_selected_agent',
  SELECTED_REQUIREMENT: 'prompt_workstation_selected_requirement',
  CURRENT_PROJECT: 'prompt_workstation_current_project',
  FORM_DRAFTS: 'prompt_workstation_form_drafts',
  THEME_PREFERENCES: 'prompt_workstation_theme_preferences',
  CACHED_DATA: 'prompt_workstation_cached_data'
} as const;

/**
 * Generic storage operations with error handling
 */
class Storage {
  private isAvailable(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  set<T>(key: string, value: T): boolean {
    if (!this.isAvailable()) return false;
    
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
      return false;
    }
  }

  get<T>(key: string, defaultValue?: T): T | null {
    if (!this.isAvailable()) return defaultValue || null;
    
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : (defaultValue || null);
    } catch (error) {
      console.warn('Failed to read from localStorage:', error);
      return defaultValue || null;
    }
  }

  remove(key: string): boolean {
    if (!this.isAvailable()) return false;
    
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn('Failed to remove from localStorage:', error);
      return false;
    }
  }

  clear(): boolean {
    if (!this.isAvailable()) return false;
    
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.warn('Failed to clear localStorage:', error);
      return false;
    }
  }
}

const storage = new Storage();

/**
 * UI State Management
 */
export const uiState = {
  save(state: Partial<UIState>): boolean {
    const currentState = this.load();
    const newState = { ...currentState, ...state };
    return storage.set(STORAGE_KEYS.UI_STATE, newState);
  },

  load(): UIState {
    return storage.get<UIState>(STORAGE_KEYS.UI_STATE, {
      selectedAgentId: null,
      selectedRequirementId: null,
      currentProjectId: null,
      sidebarOpen: false,
      activeView: 'builder',
      syncStatus: 'synced'
    });
  },

  clear(): boolean {
    return storage.remove(STORAGE_KEYS.UI_STATE);
  }
};

/**
 * Selected Items Management
 */
export const selections = {
  setAgent(agentId: string | null): boolean {
    const success = storage.set(STORAGE_KEYS.SELECTED_AGENT, agentId);
    if (success) {
      uiState.save({ selectedAgentId: agentId });
    }
    return success;
  },

  getAgent(): string | null {
    return storage.get<string>(STORAGE_KEYS.SELECTED_AGENT);
  },

  setRequirement(requirementId: string | null): boolean {
    const success = storage.set(STORAGE_KEYS.SELECTED_REQUIREMENT, requirementId);
    if (success) {
      uiState.save({ selectedRequirementId: requirementId });
    }
    return success;
  },

  getRequirement(): string | null {
    return storage.get<string>(STORAGE_KEYS.SELECTED_REQUIREMENT);
  },

  setProject(projectId: string | null): boolean {
    const success = storage.set(STORAGE_KEYS.CURRENT_PROJECT, projectId);
    if (success) {
      uiState.save({ currentProjectId: projectId });
    }
    return success;
  },

  getProject(): string | null {
    return storage.get<string>(STORAGE_KEYS.CURRENT_PROJECT);
  },

  clear(): boolean {
    return storage.remove(STORAGE_KEYS.SELECTED_AGENT) &&
           storage.remove(STORAGE_KEYS.SELECTED_REQUIREMENT) &&
           storage.remove(STORAGE_KEYS.CURRENT_PROJECT);
  }
};

/**
 * Form Draft Management
 */
export interface FormDraft {
  formId: string;
  data: Record<string, any>;
  timestamp: number;
}

export const formDrafts = {
  save(formId: string, data: Record<string, any>): boolean {
    const drafts = this.getAll();
    const draft: FormDraft = {
      formId,
      data,
      timestamp: Date.now()
    };
    
    const updatedDrafts = drafts.filter(d => d.formId !== formId);
    updatedDrafts.push(draft);
    
    // Keep only the 10 most recent drafts
    const recentDrafts = updatedDrafts
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);
    
    return storage.set(STORAGE_KEYS.FORM_DRAFTS, recentDrafts);
  },

  get(formId: string): FormDraft | null {
    const drafts = this.getAll();
    return drafts.find(d => d.formId === formId) || null;
  },

  getAll(): FormDraft[] {
    return storage.get<FormDraft[]>(STORAGE_KEYS.FORM_DRAFTS, []);
  },

  remove(formId: string): boolean {
    const drafts = this.getAll();
    const updatedDrafts = drafts.filter(d => d.formId !== formId);
    return storage.set(STORAGE_KEYS.FORM_DRAFTS, updatedDrafts);
  },

  clear(): boolean {
    return storage.remove(STORAGE_KEYS.FORM_DRAFTS);
  }
};

/**
 * Theme Preferences
 */
export interface ThemePreferences {
  selectedThemeId?: string;
  customColors?: Record<string, string>;
  fontSize?: 'small' | 'medium' | 'large';
  reducedMotion?: boolean;
}

export const themePreferences = {
  save(preferences: Partial<ThemePreferences>): boolean {
    const current = this.load();
    const updated = { ...current, ...preferences };
    return storage.set(STORAGE_KEYS.THEME_PREFERENCES, updated);
  },

  load(): ThemePreferences {
    return storage.get<ThemePreferences>(STORAGE_KEYS.THEME_PREFERENCES, {});
  },

  clear(): boolean {
    return storage.remove(STORAGE_KEYS.THEME_PREFERENCES);
  }
};

/**
 * Data Caching
 */
export interface CachedData {
  agents?: { data: Agent[]; timestamp: number };
  requirements?: { data: OutputRequirement[]; timestamp: number };
  projects?: { data: Project[]; timestamp: number };
}

export const cache = {
  set<T>(key: keyof CachedData, data: T, ttl: number = 5 * 60 * 1000): boolean {
    const cached = this.getAll();
    cached[key] = {
      data,
      timestamp: Date.now() + ttl
    } as any;
    return storage.set(STORAGE_KEYS.CACHED_DATA, cached);
  },

  get<T>(key: keyof CachedData): T | null {
    const cached = this.getAll();
    const item = cached[key];
    
    if (!item) return null;
    
    if (Date.now() > item.timestamp) {
      this.remove(key);
      return null;
    }
    
    return item.data as T;
  },

  remove(key: keyof CachedData): boolean {
    const cached = this.getAll();
    delete cached[key];
    return storage.set(STORAGE_KEYS.CACHED_DATA, cached);
  },

  getAll(): CachedData {
    return storage.get<CachedData>(STORAGE_KEYS.CACHED_DATA, {});
  },

  clear(): boolean {
    return storage.remove(STORAGE_KEYS.CACHED_DATA);
  },

  isValid(key: keyof CachedData): boolean {
    const cached = this.getAll();
    const item = cached[key];
    return item ? Date.now() <= item.timestamp : false;
  }
};

/**
 * Utility functions
 */
export const storageUtils = {
  // Get storage usage information
  getUsage(): { used: number; available: number; percentage: number } {
    if (!storage['isAvailable']()) {
      return { used: 0, available: 0, percentage: 0 };
    }

    let used = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        used += localStorage[key].length + key.length;
      }
    }

    // Rough estimate of available space (5MB typical limit)
    const available = 5 * 1024 * 1024;
    const percentage = (used / available) * 100;

    return { used, available, percentage };
  },

  // Clean up expired cache entries
  cleanup(): boolean {
    const cached = cache.getAll();
    let hasChanges = false;

    for (const key in cached) {
      const item = cached[key as keyof CachedData];
      if (item && Date.now() > item.timestamp) {
        delete cached[key as keyof CachedData];
        hasChanges = true;
      }
    }

    return hasChanges ? storage.set(STORAGE_KEYS.CACHED_DATA, cached) : true;
  },

  // Export all data for backup
  exportAll(): Record<string, any> {
    const data: Record<string, any> = {};
    
    for (const key of Object.values(STORAGE_KEYS)) {
      const value = storage.get(key);
      if (value !== null) {
        data[key] = value;
      }
    }
    
    return data;
  },

  // Import data from backup
  importAll(data: Record<string, any>): boolean {
    try {
      for (const [key, value] of Object.entries(data)) {
        if (Object.values(STORAGE_KEYS).includes(key as any)) {
          storage.set(key, value);
        }
      }
      return true;
    } catch (error) {
      console.error('Failed to import storage data:', error);
      return false;
    }
  }
};

// Initialize cleanup on load
if (typeof window !== 'undefined') {
  storageUtils.cleanup();
}

export default storage;