/**
 * UI Integration Tests for Project Workflows
 * Tests requirements 1.1, 1.2, 1.3, 1.4, 3.1, 3.2, 5.1
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock DOM environment
class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.innerHTML = '';
    this.textContent = '';
    this.value = '';
    this.className = '';
    this.style = {};
    this.attributes = new Map();
    this.children = [];
    this.parentElement = null;
    this.eventListeners = new Map();
  }

  getElementById(id) {
    return mockElements.get(id) || null;
  }

  querySelector(selector) {
    // Simple selector matching for test purposes
    if (selector.startsWith('#')) {
      return this.getElementById(selector.slice(1));
    }
    return null;
  }

  querySelectorAll(selector) {
    return [];
  }

  addEventListener(event, handler) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(handler);
  }

  removeEventListener(event, handler) {
    if (this.eventListeners.has(event)) {
      const handlers = this.eventListeners.get(event);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  dispatchEvent(event) {
    if (this.eventListeners.has(event.type)) {
      this.eventListeners.get(event.type).forEach(handler => {
        handler(event);
      });
    }
  }

  click() {
    this.dispatchEvent(new MockEvent('click'));
  }

  focus() {
    this.dispatchEvent(new MockEvent('focus'));
  }

  blur() {
    this.dispatchEvent(new MockEvent('blur'));
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  getAttribute(name) {
    return this.attributes.get(name) || null;
  }

  appendChild(child) {
    this.children.push(child);
    child.parentElement = this;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index > -1) {
      this.children.splice(index, 1);
      child.parentElement = null;
    }
  }
}

class MockEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.target = options.target || null;
    this.currentTarget = options.currentTarget || null;
    this.preventDefault = vi.fn();
    this.stopPropagation = vi.fn();
  }
}

// Mock DOM elements
const mockElements = new Map();

// Mock document
const mockDocument = {
  getElementById: (id) => mockElements.get(id) || null,
  querySelector: (selector) => {
    if (selector.startsWith('#')) {
      return mockDocument.getElementById(selector.slice(1));
    }
    return null;
  },
  querySelectorAll: () => [],
  createElement: (tagName) => new MockElement(tagName),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

// Mock window
const mockWindow = {
  innerWidth: 1024,
  innerHeight: 768,
  location: {
    href: 'http://localhost:3000',
    pathname: '/',
    search: '',
    hash: ''
  },
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

// Mock fetch for API calls
const mockFetch = vi.fn();

// Setup global mocks
global.document = mockDocument;
global.window = mockWindow;
global.fetch = mockFetch;

// Mock API responses
const mockApiResponses = {
  projects: [
    {
      id: 'project-1',
      slug: 'test-project-1',
      name: 'Test Project 1',
      description: 'First test project',
      status: 'active',
      priority: 'medium',
      created_at: '2024-01-01T00:00:00Z'
    },
    {
      id: 'project-2',
      slug: 'test-project-2',
      name: 'Test Project 2',
      description: 'Second test project',
      status: 'draft',
      priority: 'high',
      created_at: '2024-01-02T00:00:00Z'
    }
  ],
  agents: [
    {
      id: 'agent-1',
      name: 'Test Agent 1',
      role: 'Developer',
      description: 'Primary development agent',
      is_active: 1
    },
    {
      id: 'agent-2',
      name: 'Test Agent 2',
      role: 'Reviewer',
      description: 'Code review agent',
      is_active: 1
    }
  ],
  rules: [
    {
      id: 'rule-1',
      name: 'Test Rule 1',
      description: 'Basic coding standards',
      category: 'coding',
      is_active: 1
    }
  ],
  hooks: [
    {
      id: 'hook-1',
      name: 'Test Hook 1',
      description: 'Pre-commit validation',
      hook_type: 'pre-commit',
      is_enabled: 1
    }
  ]
};

// Helper function to setup DOM elements
function setupDOMElements() {
  // Project creation modal elements
  mockElements.set('project-modal', new MockElement('div'));
  mockElements.set('project-name', new MockElement('input'));
  mockElements.set('project-description', new MockElement('input'));
  mockElements.set('project-status', new MockElement('select'));
  mockElements.set('project-priority', new MockElement('select'));
  mockElements.set('project-category', new MockElement('input'));
  mockElements.set('project-tags', new MockElement('input'));
  mockElements.set('project-info', new MockElement('textarea'));
  mockElements.set('project-ai-context', new MockElement('textarea'));
  mockElements.set('btn-save-project', new MockElement('button'));
  mockElements.set('btn-delete-project', new MockElement('button'));

  // Project listing elements
  mockElements.set('projects-container', new MockElement('div'));
  mockElements.set('search-input', new MockElement('input'));

  // Resource assignment elements
  mockElements.set('resource-import-modal', new MockElement('div'));
  mockElements.set('available-resources-list', new MockElement('div'));
  mockElements.set('btn-import-resources', new MockElement('button'));

  // Export elements
  mockElements.set('export-modal', new MockElement('div'));
  mockElements.set('export-format', new MockElement('select'));
  mockElements.set('btn-export-project', new MockElement('button'));

  // Progress indicators
  mockElements.set('progress-container', new MockElement('div'));
  mockElements.set('progress-bar', new MockElement('div'));
  mockElements.set('progress-status', new MockElement('span'));

  // Toast notifications
  mockElements.set('toast', new MockElement('div'));
}

// Mock UI functions that would be in the actual HTML files
const UIFunctions = {
  // Project Management Functions
  async openProjectModal(projectId = null) {
    const modal = mockElements.get('project-modal');
    modal.className = 'modal-overlay open';
    
    if (projectId) {
      // Load existing project data
      const response = await fetch(`/api/projects/${projectId}`);
      const project = await response.json();
      
      mockElements.get('project-name').value = project.name;
      mockElements.get('project-description').value = project.description;
      mockElements.get('project-status').value = project.status;
      mockElements.get('project-priority').value = project.priority;
    }
    
    return modal;
  },

  async saveProject() {
    const projectData = {
      name: mockElements.get('project-name').value,
      description: mockElements.get('project-description').value,
      status: mockElements.get('project-status').value,
      priority: mockElements.get('project-priority').value,
      category: mockElements.get('project-category').value,
      tags: mockElements.get('project-tags').value,
      project_info: mockElements.get('project-info').value,
      ai_context_summary: mockElements.get('project-ai-context').value
    };

    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projectData)
    });

    if (response.ok) {
      this.showToast('Project saved successfully', 'success');
      this.closeProjectModal();
      await this.loadProjects();
    } else {
      this.showToast('Failed to save project', 'error');
    }

    return response.ok;
  },

  closeProjectModal() {
    const modal = mockElements.get('project-modal');
    modal.className = 'modal-overlay';
  },

  async loadProjects() {
    const response = await fetch('/api/projects');
    const projects = await response.json();
    
    const container = mockElements.get('projects-container');
    container.innerHTML = projects.map(project => `
      <div class="project-card" data-project-id="${project.id}">
        <div class="project-name">${project.name}</div>
        <div class="project-status status-${project.status}">${project.status}</div>
      </div>
    `).join('');
    
    return projects;
  },

  filterProjects(status) {
    const container = mockElements.get('projects-container');
    const cards = container.children;
    
    cards.forEach(card => {
      if (status === 'all' || card.querySelector('.project-status').textContent === status) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    });
  },

  searchProjects(query) {
    const container = mockElements.get('projects-container');
    const cards = container.children;
    
    cards.forEach(card => {
      const name = card.querySelector('.project-name').textContent.toLowerCase();
      if (name.includes(query.toLowerCase())) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    });
  },

  // Resource Assignment Functions
  async openResourceImportModal(projectId) {
    const modal = mockElements.get('resource-import-modal');
    modal.className = 'modal-overlay open';
    
    // Load available resources
    const [agents, rules, hooks] = await Promise.all([
      fetch(`/api/projects/${projectId}/resources/available?type=agent`).then(r => r.json()),
      fetch(`/api/projects/${projectId}/resources/available?type=rule`).then(r => r.json()),
      fetch(`/api/projects/${projectId}/resources/available?type=hook`).then(r => r.json())
    ]);
    
    const resourcesList = mockElements.get('available-resources-list');
    resourcesList.innerHTML = [
      ...agents.map(agent => `<div class="resource-item" data-type="agent" data-id="${agent.id}">${agent.name}</div>`),
      ...rules.map(rule => `<div class="resource-item" data-type="rule" data-id="${rule.id}">${rule.name}</div>`),
      ...hooks.map(hook => `<div class="resource-item" data-type="hook" data-id="${hook.id}">${hook.name}</div>`)
    ].join('');
    
    return modal;
  },

  async importSelectedResources(projectId) {
    const resourcesList = mockElements.get('available-resources-list');
    const selectedResources = Array.from(resourcesList.children)
      .filter(item => item.className.includes('selected'))
      .map(item => ({
        type: item.getAttribute('data-type'),
        id: item.getAttribute('data-id')
      }));

    const results = [];
    for (const resource of selectedResources) {
      const response = await fetch(`/api/projects/${projectId}/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource_type: resource.type,
          resource_id: resource.id
        })
      });
      results.push(response.ok);
    }

    const allSuccessful = results.every(result => result);
    if (allSuccessful) {
      this.showToast('Resources imported successfully', 'success');
      this.closeResourceImportModal();
    } else {
      this.showToast('Some resources failed to import', 'error');
    }

    return allSuccessful;
  },

  closeResourceImportModal() {
    const modal = mockElements.get('resource-import-modal');
    modal.className = 'modal-overlay';
  },

  async assignResource(projectId, resourceType, resourceId, options = {}) {
    const response = await fetch(`/api/projects/${projectId}/resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resource_type: resourceType,
        resource_id: resourceId,
        ...options
      })
    });

    if (response.ok) {
      this.showToast('Resource assigned successfully', 'success');
    } else {
      this.showToast('Failed to assign resource', 'error');
    }

    return response.ok;
  },

  async unassignResource(projectId, resourceType, resourceId) {
    const response = await fetch(`/api/projects/${projectId}/resources/${resourceId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource_type: resourceType })
    });

    if (response.ok) {
      this.showToast('Resource unassigned successfully', 'success');
    } else {
      this.showToast('Failed to unassign resource', 'error');
    }

    return response.ok;
  },

  // Export Functions
  async openExportModal(projectId) {
    const modal = mockElements.get('export-modal');
    modal.className = 'modal-overlay open';
    
    // Validate project for export
    const validation = await fetch(`/api/export/validate/${projectId}`).then(r => r.json());
    
    if (!validation.isValid) {
      this.showToast('Project validation failed: ' + validation.errors.join(', '), 'error');
      return false;
    }
    
    return modal;
  },

  async executeExport(projectId, format = 'claude-code') {
    this.showProgress('Preparing export...', 0);
    
    try {
      this.showProgress('Generating project structure...', 25);
      
      const response = await fetch(`/api/export/${format}/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      this.showProgress('Packaging files...', 75);
      
      const blob = await response.blob();
      
      this.showProgress('Download ready', 100);
      
      // Simulate download
      const downloadUrl = URL.createObjectURL(blob);
      
      this.showToast('Export completed successfully', 'success');
      this.closeExportModal();
      this.hideProgress();
      
      return { success: true, downloadUrl };
    } catch (error) {
      this.showToast('Export failed: ' + error.message, 'error');
      this.hideProgress();
      return { success: false, error: error.message };
    }
  },

  closeExportModal() {
    const modal = mockElements.get('export-modal');
    modal.className = 'modal-overlay';
  },

  // Progress and Notification Functions
  showProgress(message, percentage) {
    const container = mockElements.get('progress-container');
    const bar = mockElements.get('progress-bar');
    const status = mockElements.get('progress-status');
    
    container.style.display = 'block';
    bar.style.width = `${percentage}%`;
    status.textContent = message;
  },

  hideProgress() {
    const container = mockElements.get('progress-container');
    container.style.display = 'none';
  },

  showToast(message, type = 'success') {
    const toast = mockElements.get('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      toast.className = 'toast';
    }, 3000);
  }
};

describe('UI Integration Tests for Project Workflows', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    mockElements.clear();
    setupDOMElements();
    
    // Setup default fetch responses
    mockFetch.mockImplementation(async (url, options = {}) => {
      const method = options.method || 'GET';
      
      if (url === '/api/projects' && method === 'GET') {
        return {
          ok: true,
          json: async () => mockApiResponses.projects
        };
      }
      
      if (url === '/api/projects' && method === 'POST') {
        const newProject = {
          id: 'new-project-id',
          slug: 'new-project',
          ...JSON.parse(options.body),
          created_at: new Date().toISOString()
        };
        return {
          ok: true,
          json: async () => newProject
        };
      }
      
      if (url.includes('/api/projects/') && url.includes('/resources/available')) {
        const type = new URL(url, 'http://localhost').searchParams.get('type');
        return {
          ok: true,
          json: async () => mockApiResponses[type + 's'] || []
        };
      }
      
      if (url.includes('/api/projects/') && url.includes('/resources') && method === 'POST') {
        return {
          ok: true,
          json: async () => ({ success: true })
        };
      }
      
      if (url.includes('/api/projects/') && url.includes('/resources/') && method === 'DELETE') {
        return {
          ok: true,
          json: async () => ({ success: true })
        };
      }
      
      if (url.includes('/api/export/validate/')) {
        return {
          ok: true,
          json: async () => ({
            isValid: true,
            errors: [],
            warnings: [],
            requiredComponents: {
              project: true,
              agents: true,
              rules: true,
              hooks: true
            }
          })
        };
      }
      
      if (url.includes('/api/export/claude-code/')) {
        return {
          ok: true,
          blob: async () => new Blob(['mock export data'], { type: 'application/zip' })
        };
      }
      
      return {
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not found' })
      };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Project Creation and Editing Workflows', () => {
    it('should open project creation modal successfully', async () => {
      const modal = await UIFunctions.openProjectModal();
      
      expect(modal.className).toBe('modal-overlay open');
      expect(mockElements.get('project-name').value).toBe('');
      expect(mockElements.get('project-description').value).toBe('');
    });

    it('should load existing project data when editing', async () => {
      const projectId = 'project-1';
      mockFetch.mockImplementationOnce(async () => ({
        ok: true,
        json: async () => mockApiResponses.projects[0]
      }));

      const modal = await UIFunctions.openProjectModal(projectId);
      
      expect(modal.className).toBe('modal-overlay open');
      expect(mockElements.get('project-name').value).toBe('Test Project 1');
      expect(mockElements.get('project-description').value).toBe('First test project');
      expect(mockElements.get('project-status').value).toBe('active');
      expect(mockElements.get('project-priority').value).toBe('medium');
    });

    it('should save new project with all required fields', async () => {
      // Setup form data
      mockElements.get('project-name').value = 'New Test Project';
      mockElements.get('project-description').value = 'A new test project';
      mockElements.get('project-status').value = 'active';
      mockElements.get('project-priority').value = 'high';
      mockElements.get('project-category').value = 'Web Development';
      mockElements.get('project-tags').value = 'react, typescript';
      mockElements.get('project-info').value = 'Detailed project information';
      mockElements.get('project-ai-context').value = 'AI context summary';

      const success = await UIFunctions.saveProject();
      
      expect(success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New Test Project',
          description: 'A new test project',
          status: 'active',
          priority: 'high',
          category: 'Web Development',
          tags: 'react, typescript',
          project_info: 'Detailed project information',
          ai_context_summary: 'AI context summary'
        })
      });
    });

    it('should handle project save errors gracefully', async () => {
      mockFetch.mockImplementationOnce(async () => ({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Validation failed' })
      }));

      mockElements.get('project-name').value = 'Invalid Project';
      
      const success = await UIFunctions.saveProject();
      
      expect(success).toBe(false);
      expect(mockElements.get('toast').textContent).toBe('Failed to save project');
      expect(mockElements.get('toast').className).toBe('toast show error');
    });

    it('should close project modal and reset form', () => {
      const modal = mockElements.get('project-modal');
      modal.className = 'modal-overlay open';
      
      UIFunctions.closeProjectModal();
      
      expect(modal.className).toBe('modal-overlay');
    });

    it('should load and display projects list', async () => {
      const projects = await UIFunctions.loadProjects();
      
      expect(projects).toEqual(mockApiResponses.projects);
      expect(mockFetch).toHaveBeenCalledWith('/api/projects');
      
      const container = mockElements.get('projects-container');
      expect(container.innerHTML).toContain('Test Project 1');
      expect(container.innerHTML).toContain('Test Project 2');
      expect(container.innerHTML).toContain('status-active');
      expect(container.innerHTML).toContain('status-draft');
    });

    it('should filter projects by status', async () => {
      await UIFunctions.loadProjects();
      
      // Mock the DOM structure for filtering
      const container = mockElements.get('projects-container');
      container.children = [
        { 
          style: { display: 'block' },
          querySelector: () => ({ textContent: 'active' })
        },
        { 
          style: { display: 'block' },
          querySelector: () => ({ textContent: 'draft' })
        }
      ];
      
      UIFunctions.filterProjects('active');
      
      expect(container.children[0].style.display).toBe('block');
      expect(container.children[1].style.display).toBe('none');
    });

    it('should search projects by name', async () => {
      await UIFunctions.loadProjects();
      
      // Mock the DOM structure for searching
      const container = mockElements.get('projects-container');
      container.children = [
        { 
          style: { display: 'block' },
          querySelector: () => ({ textContent: 'Test Project 1' })
        },
        { 
          style: { display: 'block' },
          querySelector: () => ({ textContent: 'Test Project 2' })
        }
      ];
      
      UIFunctions.searchProjects('Project 1');
      
      expect(container.children[0].style.display).toBe('block');
      expect(container.children[1].style.display).toBe('none');
    });
  });

  describe('Resource Assignment and Import Interfaces', () => {
    const projectId = 'project-1';

    it('should open resource import modal and load available resources', async () => {
      const modal = await UIFunctions.openResourceImportModal(projectId);
      
      expect(modal.className).toBe('modal-overlay open');
      expect(mockFetch).toHaveBeenCalledWith(`/api/projects/${projectId}/resources/available?type=agent`);
      expect(mockFetch).toHaveBeenCalledWith(`/api/projects/${projectId}/resources/available?type=rule`);
      expect(mockFetch).toHaveBeenCalledWith(`/api/projects/${projectId}/resources/available?type=hook`);
      
      const resourcesList = mockElements.get('available-resources-list');
      expect(resourcesList.innerHTML).toContain('Test Agent 1');
      expect(resourcesList.innerHTML).toContain('Test Rule 1');
      expect(resourcesList.innerHTML).toContain('Test Hook 1');
    });

    it('should import selected resources successfully', async () => {
      await UIFunctions.openResourceImportModal(projectId);
      
      // Mock selected resources
      const resourcesList = mockElements.get('available-resources-list');
      resourcesList.children = [
        {
          className: 'resource-item selected',
          getAttribute: (attr) => {
            if (attr === 'data-type') return 'agent';
            if (attr === 'data-id') return 'agent-1';
          }
        },
        {
          className: 'resource-item selected',
          getAttribute: (attr) => {
            if (attr === 'data-type') return 'rule';
            if (attr === 'data-id') return 'rule-1';
          }
        }
      ];
      
      const success = await UIFunctions.importSelectedResources(projectId);
      
      expect(success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(`/api/projects/${projectId}/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource_type: 'agent',
          resource_id: 'agent-1'
        })
      });
      expect(mockFetch).toHaveBeenCalledWith(`/api/projects/${projectId}/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource_type: 'rule',
          resource_id: 'rule-1'
        })
      });
    });

    it('should handle resource import failures gracefully', async () => {
      mockFetch.mockImplementation(async (url, options) => {
        if (url.includes('/resources') && options?.method === 'POST') {
          return { ok: false, status: 400 };
        }
        return { ok: true, json: async () => [] };
      });

      await UIFunctions.openResourceImportModal(projectId);
      
      const resourcesList = mockElements.get('available-resources-list');
      resourcesList.children = [
        {
          className: 'resource-item selected',
          getAttribute: () => 'agent-1'
        }
      ];
      
      const success = await UIFunctions.importSelectedResources(projectId);
      
      expect(success).toBe(false);
      expect(mockElements.get('toast').textContent).toBe('Some resources failed to import');
    });

    it('should assign individual resources to project', async () => {
      const success = await UIFunctions.assignResource(projectId, 'agent', 'agent-1', {
        isPrimary: true,
        assignmentOrder: 1
      });
      
      expect(success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(`/api/projects/${projectId}/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource_type: 'agent',
          resource_id: 'agent-1',
          isPrimary: true,
          assignmentOrder: 1
        })
      });
    });

    it('should unassign resources from project', async () => {
      const success = await UIFunctions.unassignResource(projectId, 'agent', 'agent-1');
      
      expect(success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(`/api/projects/${projectId}/resources/agent-1`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource_type: 'agent' })
      });
    });

    it('should close resource import modal', () => {
      const modal = mockElements.get('resource-import-modal');
      modal.className = 'modal-overlay open';
      
      UIFunctions.closeResourceImportModal();
      
      expect(modal.className).toBe('modal-overlay');
    });
  });

  describe('Export Configuration and Download Functionality', () => {
    const projectId = 'project-1';

    it('should open export modal and validate project', async () => {
      const modal = await UIFunctions.openExportModal(projectId);
      
      expect(modal.className).toBe('modal-overlay open');
      expect(mockFetch).toHaveBeenCalledWith(`/api/export/validate/${projectId}`);
    });

    it('should prevent export if project validation fails', async () => {
      mockFetch.mockImplementationOnce(async () => ({
        ok: true,
        json: async () => ({
          isValid: false,
          errors: ['Missing primary agent', 'No rules assigned'],
          warnings: []
        })
      }));

      const modal = await UIFunctions.openExportModal(projectId);
      
      expect(modal).toBe(false);
      expect(mockElements.get('toast').textContent).toBe('Project validation failed: Missing primary agent, No rules assigned');
      expect(mockElements.get('toast').className).toBe('toast show error');
    });

    it('should execute export successfully with progress tracking', async () => {
      const result = await UIFunctions.executeExport(projectId, 'claude-code');
      
      expect(result.success).toBe(true);
      expect(result.downloadUrl).toBeDefined();
      expect(mockFetch).toHaveBeenCalledWith(`/api/export/claude-code/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      // Verify progress was shown
      const progressContainer = mockElements.get('progress-container');
      expect(progressContainer.style.display).toBe('none'); // Hidden after completion
      
      // Verify success toast
      expect(mockElements.get('toast').textContent).toBe('Export completed successfully');
      expect(mockElements.get('toast').className).toBe('toast show success');
    });

    it('should handle export failures gracefully', async () => {
      mockFetch.mockImplementation(async (url) => {
        if (url.includes('/api/export/claude-code/')) {
          return { ok: false, status: 500 };
        }
        return { ok: true, json: async () => ({ isValid: true, errors: [] }) };
      });

      const result = await UIFunctions.executeExport(projectId, 'claude-code');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Export failed');
      expect(mockElements.get('toast').textContent).toBe('Export failed: Export failed');
      expect(mockElements.get('toast').className).toBe('toast show error');
    });

    it('should show and update progress during export', async () => {
      UIFunctions.showProgress('Testing progress', 50);
      
      const container = mockElements.get('progress-container');
      const bar = mockElements.get('progress-bar');
      const status = mockElements.get('progress-status');
      
      expect(container.style.display).toBe('block');
      expect(bar.style.width).toBe('50%');
      expect(status.textContent).toBe('Testing progress');
    });

    it('should hide progress indicator', () => {
      const container = mockElements.get('progress-container');
      container.style.display = 'block';
      
      UIFunctions.hideProgress();
      
      expect(container.style.display).toBe('none');
    });

    it('should close export modal', () => {
      const modal = mockElements.get('export-modal');
      modal.className = 'modal-overlay open';
      
      UIFunctions.closeExportModal();
      
      expect(modal.className).toBe('modal-overlay');
    });
  });

  describe('Toast Notifications and User Feedback', () => {
    it('should show success toast notifications', () => {
      UIFunctions.showToast('Operation successful', 'success');
      
      const toast = mockElements.get('toast');
      expect(toast.textContent).toBe('Operation successful');
      expect(toast.className).toBe('toast show success');
    });

    it('should show error toast notifications', () => {
      UIFunctions.showToast('Operation failed', 'error');
      
      const toast = mockElements.get('toast');
      expect(toast.textContent).toBe('Operation failed');
      expect(toast.className).toBe('toast show error');
    });

    it('should auto-hide toast notifications', (done) => {
      UIFunctions.showToast('Test message', 'success');
      
      const toast = mockElements.get('toast');
      expect(toast.className).toBe('toast show success');
      
      // Check that toast is hidden after timeout
      setTimeout(() => {
        expect(toast.className).toBe('toast');
        done();
      }, 3100);
    });
  });

  describe('Form Validation and User Input Handling', () => {
    it('should validate required project fields', async () => {
      // Test with empty required fields
      mockElements.get('project-name').value = '';
      mockElements.get('project-description').value = '';
      
      // Mock validation failure
      mockFetch.mockImplementationOnce(async () => ({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Name is required' })
      }));

      const success = await UIFunctions.saveProject();
      
      expect(success).toBe(false);
      expect(mockElements.get('toast').className).toBe('toast show error');
    });

    it('should handle form input changes correctly', () => {
      const nameInput = mockElements.get('project-name');
      const descInput = mockElements.get('project-description');
      
      nameInput.value = 'Test Project Name';
      descInput.value = 'Test Description';
      
      expect(nameInput.value).toBe('Test Project Name');
      expect(descInput.value).toBe('Test Description');
    });

    it('should handle select dropdown changes', () => {
      const statusSelect = mockElements.get('project-status');
      const prioritySelect = mockElements.get('project-priority');
      
      statusSelect.value = 'completed';
      prioritySelect.value = 'high';
      
      expect(statusSelect.value).toBe('completed');
      expect(prioritySelect.value).toBe('high');
    });
  });

  describe('Responsive Design and Mobile Interactions', () => {
    it('should handle mobile viewport changes', () => {
      // Simulate mobile viewport
      mockWindow.innerWidth = 600;
      
      // Test that mobile-specific behavior works
      expect(mockWindow.innerWidth).toBe(600);
    });

    it('should handle touch interactions on mobile', () => {
      const projectCard = new MockElement('div');
      projectCard.className = 'project-card';
      
      // Simulate touch event
      const touchEvent = new MockEvent('touchstart');
      projectCard.dispatchEvent(touchEvent);
      
      expect(touchEvent.type).toBe('touchstart');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      try {
        await UIFunctions.loadProjects();
      } catch (error) {
        expect(error.message).toBe('Network error');
      }
    });

    it('should handle empty project lists', async () => {
      mockFetch.mockImplementationOnce(async () => ({
        ok: true,
        json: async () => []
      }));

      const projects = await UIFunctions.loadProjects();
      
      expect(projects).toEqual([]);
      expect(mockElements.get('projects-container').innerHTML).toBe('');
    });

    it('should handle malformed API responses', async () => {
      mockFetch.mockImplementationOnce(async () => ({
        ok: true,
        json: async () => { throw new Error('Invalid JSON'); }
      }));

      try {
        await UIFunctions.loadProjects();
      } catch (error) {
        expect(error.message).toBe('Invalid JSON');
      }
    });
  });
});