# Astro Migration Design Document

## Overview

This design outlines the migration of the Semantic Prompt Workstation from vanilla JavaScript to Astro 5.0. The migration will transform the current single-page application into a modern, component-based architecture while preserving all existing functionality, PWA capabilities, and backend integration. The design emphasizes incremental migration, performance optimization, and improved developer experience.

## Architecture

### Current Architecture
- **Frontend**: Single `index.html` file with embedded CSS and JavaScript
- **Backend**: Cloudflare Workers with Hono framework
- **Database**: Cloudflare D1 (SQLite)
- **Deployment**: Static assets served via Cloudflare Workers Assets

### Target Architecture
- **Frontend**: Astro 5.0 with component-based architecture
- **Build System**: Astro's Vite-based build pipeline
- **Components**: Astro components with selective hydration
- **Styling**: Scoped CSS with Astro's built-in styling features
- **TypeScript**: Full TypeScript support for type safety
- **Backend**: Unchanged Cloudflare Workers setup
- **Deployment**: Astro static build output served via Cloudflare Workers Assets

### Migration Strategy
The migration will follow a **page-by-page, component-by-component** approach:

1. **Setup Phase**: Initialize Astro project structure
2. **Core Migration**: Convert main application shell
3. **Feature Migration**: Migrate individual features as components
4. **PWA Integration**: Implement PWA features in Astro
5. **Optimization**: Performance tuning and final optimizations

## Components and Interfaces

### Component Hierarchy
```
src/
├── layouts/
│   └── Layout.astro           # Main application layout
├── components/
│   ├── AgentManager.astro     # Agent CRUD operations
│   ├── PromptBuilder.astro    # Interactive prompt form
│   ├── ThemeManager.astro     # Theme customization
│   ├── ExportPanel.astro      # Claude Code export
│   ├── Navigation.astro       # App navigation
│   └── ui/
│       ├── Button.astro       # Reusable button component
│       ├── Modal.astro        # Modal dialog component
│       ├── Form.astro         # Form components
│       └── Toast.astro        # Notification component
├── pages/
│   ├── index.astro           # Main application page
│   ├── agents.astro          # Agent management page
│   ├── themes.astro          # Theme management page
│   └── export.astro          # Export functionality page
├── scripts/
│   ├── api.ts                # API client functions
│   ├── storage.ts            # localStorage utilities
│   ├── theme.ts              # Theme management logic
│   └── pwa.ts                # PWA-specific functionality
└── styles/
    ├── global.css            # Global styles
    ├── components.css        # Component-specific styles
    └── themes.css            # Theme definitions
```

### Component Interfaces

#### AgentManager Component
```typescript
interface Agent {
  id: string;
  name: string;
  role: string;
  outputStyle: string;
  created: Date;
}

interface AgentManagerProps {
  initialAgents?: Agent[];
  onAgentChange?: (agents: Agent[]) => void;
}
```

#### PromptBuilder Component
```typescript
interface PromptConfig {
  agent: Agent;
  task: string;
  context: string;
  constraints: string[];
  outputFormat: string;
}

interface PromptBuilderProps {
  agents: Agent[];
  onPromptGenerate?: (prompt: string) => void;
}
```

#### ThemeManager Component
```typescript
interface Theme {
  id: string;
  name: string;
  colors: Record<string, string>;
  fonts: {
    primary: string;
    secondary: string;
    mono: string;
  };
}

interface ThemeManagerProps {
  themes: Theme[];
  activeTheme: string;
  onThemeChange?: (themeId: string) => void;
}
```

## Data Models

### Astro Configuration
```javascript
// astro.config.mjs
export default defineConfig({
  output: 'static',
  integrations: [
    // PWA integration for service worker and manifest
    AstroPWA({
      mode: 'production',
      base: '/',
      scope: '/',
      includeAssets: ['icon.svg'],
      registerType: 'autoUpdate',
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{css,js,html,svg,png,ico,txt}']
      },
      manifest: {
        name: 'Semantic Prompt Workstation',
        short_name: 'PromptWS',
        description: 'AI Prompt Generation and Management',
        theme_color: '#1a1a1a',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ],
  vite: {
    define: {
      __BUILD_TIME__: JSON.stringify(new Date().toISOString())
    }
  }
});
```

### State Management Pattern
```typescript
// Global state using Astro's built-in patterns
class AppState {
  private static instance: AppState;
  private agents: Agent[] = [];
  private currentTheme: string = 'default';
  private listeners: Map<string, Function[]> = new Map();

  static getInstance(): AppState {
    if (!AppState.instance) {
      AppState.instance = new AppState();
    }
    return AppState.instance;
  }

  subscribe(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  emit(event: string, data: any) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(callback => callback(data));
  }
}
```

### API Integration Pattern
```typescript
// API client with error handling and type safety
class APIClient {
  private baseURL: string;

  constructor(baseURL: string = '/api') {
    this.baseURL = baseURL;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Typed methods for each API endpoint
  async getAgents(): Promise<Agent[]> {
    return this.request<Agent[]>('/agents');
  }

  async createAgent(agent: Omit<Agent, 'id'>): Promise<Agent> {
    return this.request<Agent>('/agents', {
      method: 'POST',
      body: JSON.stringify(agent)
    });
  }
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, several properties can be consolidated to eliminate redundancy:

- **Functional Equivalence Properties**: Multiple criteria test that the new system behaves identically to the old system across different features (agents, prompts, themes, export). These can be combined into comprehensive functional equivalence properties.
- **PWA Feature Properties**: Several criteria test different aspects of PWA functionality (manifest, caching, offline). These can be consolidated into core PWA behavior properties.
- **Build Output Properties**: Multiple criteria test build pipeline outputs (optimization, compatibility, assets). These can be combined into build correctness properties.

### Core Properties

**Property 1: Functional equivalence across all features**
*For any* user interaction or data operation in the migrated Astro application, the behavior and output should be identical to the original vanilla JavaScript application
**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 6.3, 6.5**

**Property 2: PWA functionality preservation**
*For any* PWA feature (offline access, caching, installation), the Astro application should provide the same capabilities as the original application
**Validates: Requirements 2.5, 3.1, 3.2, 3.3, 3.5**

**Property 3: Backend integration consistency**
*For any* API call or data persistence operation, the Astro application should communicate with the backend identically to the original application
**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

**Property 4: Build optimization correctness**
*For any* production build, the Astro build pipeline should generate optimized, deployable assets that maintain all functionality
**Validates: Requirements 1.1, 1.2, 5.5**

**Property 5: Selective hydration accuracy**
*For any* component in the application, JavaScript should only be included in the client bundle if the component requires interactivity
**Validates: Requirements 1.4**

**Property 6: State management preservation**
*For any* application state or localStorage operation, the Astro application should maintain the same state persistence patterns as the original
**Validates: Requirements 6.4**

**Property 7: CSS scoping isolation**
*For any* component with scoped styles, the CSS should not affect other components or global styles
**Validates: Requirements 5.2**

## Error Handling

### Migration Error Scenarios
1. **Component Conversion Failures**: Handle cases where vanilla JavaScript doesn't translate directly to Astro components
2. **Build Pipeline Errors**: Manage Astro build failures and provide clear error messages
3. **PWA Integration Issues**: Address service worker registration and caching problems
4. **API Compatibility Problems**: Handle cases where frontend changes affect backend communication
5. **State Migration Issues**: Manage localStorage and state transfer between old and new versions

### Error Recovery Strategies
```typescript
// Component error boundaries
class ComponentErrorBoundary {
  static wrap(component: any) {
    return {
      ...component,
      error: (error: Error) => {
        console.error('Component error:', error);
        return `<div class="error">Component failed to load</div>`;
      }
    };
  }
}

// API error handling
class APIErrorHandler {
  static async handleRequest<T>(request: Promise<T>): Promise<T | null> {
    try {
      return await request;
    } catch (error) {
      console.error('API request failed:', error);
      // Fallback to localStorage if available
      return this.getFromCache();
    }
  }
}

// Build error recovery
const buildErrorHandler = {
  onBuildError: (error: Error) => {
    console.error('Build failed:', error);
    // Provide fallback static assets
    return generateFallbackBuild();
  }
};
```

## Testing Strategy

### Dual Testing Approach

The migration will use both unit testing and property-based testing to ensure comprehensive coverage:

**Unit Testing**:
- Component rendering and behavior verification
- API integration testing with mock backends
- PWA feature testing (service worker, manifest)
- Build pipeline output validation
- State management and localStorage operations

**Property-Based Testing**:
- **Framework**: We will use **fast-check** for JavaScript/TypeScript property-based testing, which integrates well with Vitest (Astro's recommended testing framework)
- **Configuration**: Each property-based test will run a minimum of 100 iterations to ensure thorough coverage
- **Tagging**: Each property-based test will include a comment with the format: `**Feature: astro-migration, Property {number}: {property_text}**`

### Testing Implementation Requirements

1. **Unit Tests**: Focus on specific examples, edge cases, and integration points between components
2. **Property Tests**: Verify universal properties that should hold across all inputs and user interactions
3. **Migration Validation**: Compare behavior between old and new systems to ensure functional equivalence
4. **Performance Testing**: Verify that Astro optimizations improve or maintain performance metrics
5. **PWA Testing**: Validate offline functionality, caching behavior, and installation process

### Test Environment Setup
```typescript
// Vitest configuration for Astro
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true
  },
  plugins: [
    // Astro testing integration
    astro()
  ]
});

// Property-based test example structure
import fc from 'fast-check';

describe('Functional Equivalence Properties', () => {
  test('**Feature: astro-migration, Property 1: Functional equivalence across all features**', () => {
    fc.assert(fc.property(
      fc.record({
        action: fc.constantFrom('create', 'read', 'update', 'delete'),
        data: fc.object()
      }),
      (testCase) => {
        const oldResult = performActionInVanillaJS(testCase.action, testCase.data);
        const newResult = performActionInAstro(testCase.action, testCase.data);
        expect(newResult).toEqual(oldResult);
      }
    ), { numRuns: 100 });
  });
});
```

### Migration Validation Strategy

1. **Parallel Testing**: Run both old and new systems during migration to compare outputs
2. **Feature Parity Checks**: Automated tests that verify each migrated feature matches original behavior
3. **Performance Benchmarking**: Compare load times, bundle sizes, and runtime performance
4. **User Acceptance Testing**: Manual testing of critical user workflows
5. **Regression Testing**: Comprehensive test suite to catch any functionality regressions

The testing strategy ensures that the migration maintains 100% functional equivalence while gaining the benefits of modern tooling and architecture.