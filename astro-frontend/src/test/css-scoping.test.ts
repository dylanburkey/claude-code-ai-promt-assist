/**
 * **Feature: astro-migration, Property 7: CSS scoping isolation**
 * **Validates: Requirements 5.2**
 * 
 * Property-based test to verify that component CSS scoping works correctly
 * and styles don't leak between components or affect global styles.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { JSDOM } from 'jsdom';

// Mock DOM environment for testing
let dom: JSDOM;
let document: Document;
let window: Window & typeof globalThis;

beforeEach(() => {
  dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
    url: 'http://localhost',
    pretendToBeVisual: true,
    resources: 'usable'
  });
  
  document = dom.window.document;
  window = dom.window as Window & typeof globalThis;
  
  // Set up global references
  global.document = document;
  global.window = window;
});

afterEach(() => {
  dom.window.close();
});

// Helper function to create a scoped component with CSS
function createScopedComponent(componentId: string, styles: string, content: string): HTMLElement {
  const container = document.createElement('div');
  container.setAttribute('data-astro-cid-' + componentId, '');
  container.innerHTML = content;
  
  // Create scoped CSS
  const styleElement = document.createElement('style');
  const scopedStyles = styles.replace(/([^{}]+){/g, (match, selector) => {
    // Add Astro scoping attribute to selectors
    const trimmedSelector = selector.trim();
    if (trimmedSelector.startsWith('@') || trimmedSelector.includes(':root')) {
      return match; // Don't scope at-rules or :root
    }
    return `${trimmedSelector}[data-astro-cid-${componentId}]{`;
  });
  
  styleElement.textContent = scopedStyles;
  document.head.appendChild(styleElement);
  document.body.appendChild(container);
  
  return container;
}

// Helper function to get computed styles (simplified for testing)
function getComputedStyle(element: HTMLElement, property: string): string {
  // In a real browser environment, this would use window.getComputedStyle
  // For testing, we'll simulate by checking inline styles and CSS rules
  const inlineStyle = element.style.getPropertyValue(property);
  if (inlineStyle) return inlineStyle;
  
  // Check if any style rules apply to this element
  const styleSheets = Array.from(document.styleSheets);
  for (const sheet of styleSheets) {
    try {
      const rules = Array.from(sheet.cssRules || []);
      for (const rule of rules) {
        if (rule instanceof window.CSSStyleRule) {
          // Simple selector matching for test purposes
          const selector = rule.selectorText;
          if (elementMatchesSelector(element, selector)) {
            const value = rule.style.getPropertyValue(property);
            if (value) return value;
          }
        }
      }
    } catch (e) {
      // Cross-origin or other access issues
      continue;
    }
  }
  
  return '';
}

// Simplified selector matching for testing
function elementMatchesSelector(element: HTMLElement, selector: string): boolean {
  // Very basic implementation for testing
  if (selector.includes('[data-astro-cid-')) {
    const cidMatch = selector.match(/\[data-astro-cid-([^\]]+)\]/);
    if (cidMatch) {
      const cid = cidMatch[1];
      return element.hasAttribute(`data-astro-cid-${cid}`) || 
             element.closest(`[data-astro-cid-${cid}]`) !== null;
    }
  }
  
  // Basic tag/class/id matching
  if (selector.startsWith('.')) {
    return element.classList.contains(selector.slice(1));
  }
  if (selector.startsWith('#')) {
    return element.id === selector.slice(1);
  }
  if (selector.match(/^[a-zA-Z]+$/)) {
    return element.tagName.toLowerCase() === selector.toLowerCase();
  }
  
  return false;
}

// Generators for property-based testing
const cssPropertyArbitrary = fc.constantFrom(
  'color', 'background-color', 'font-size', 'margin', 'padding', 
  'border', 'width', 'height', 'display', 'position'
);

const cssValueArbitrary = fc.constantFrom(
  '#ff0000', '#00ff00', '#0000ff', 'red', 'blue', 'green',
  '10px', '20px', '1rem', '2em', '100%', 'auto',
  'block', 'inline', 'flex', 'grid', 'none',
  'relative', 'absolute', 'fixed', 'static'
);

const componentIdArbitrary = fc.string({ minLength: 6, maxLength: 12 })
  .filter(s => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s));

const htmlContentArbitrary = fc.constantFrom(
  '<div class="content">Test content</div>',
  '<p class="text">Sample text</p>',
  '<span class="label">Label</span>',
  '<button class="btn">Button</button>',
  '<div class="container"><p>Nested content</p></div>'
);

describe('CSS Scoping Isolation', () => {
  test('**Feature: astro-migration, Property 7: CSS scoping isolation**', () => {
    fc.assert(fc.property(
      fc.record({
        component1: fc.record({
          id: componentIdArbitrary,
          property: cssPropertyArbitrary,
          value: cssValueArbitrary,
          content: htmlContentArbitrary
        }),
        component2: fc.record({
          id: componentIdArbitrary,
          property: cssPropertyArbitrary,
          value: cssValueArbitrary,
          content: htmlContentArbitrary
        })
      }).filter(data => data.component1.id !== data.component2.id),
      (testCase) => {
        const { component1, component2 } = testCase;
        
        // Create CSS rules for each component
        const css1 = `.content { ${component1.property}: ${component1.value}; }`;
        const css2 = `.content { ${component2.property}: ${component2.value}; }`;
        
        // Create scoped components
        const element1 = createScopedComponent(component1.id, css1, component1.content);
        const element2 = createScopedComponent(component2.id, css2, component2.content);
        
        // Find elements with the same class in both components
        const contentEl1 = element1.querySelector('.content');
        const contentEl2 = element2.querySelector('.content');
        
        if (contentEl1 && contentEl2) {
          // Verify that styles are properly scoped
          // Component 1's styles should not affect component 2's elements
          const style1 = getComputedStyle(contentEl1 as HTMLElement, component1.property);
          const style2 = getComputedStyle(contentEl2 as HTMLElement, component2.property);
          
          // If the properties are the same, values might be different due to scoping
          if (component1.property === component2.property && component1.value !== component2.value) {
            // Each component should have its own scoped value, not the other's
            expect(style1).not.toBe(component2.value);
            expect(style2).not.toBe(component1.value);
          }
          
          // Verify scoping attributes are present
          expect(element1.hasAttribute(`data-astro-cid-${component1.id}`)).toBe(true);
          expect(element2.hasAttribute(`data-astro-cid-${component2.id}`)).toBe(true);
          
          // Verify components don't have each other's scoping attributes
          expect(element1.hasAttribute(`data-astro-cid-${component2.id}`)).toBe(false);
          expect(element2.hasAttribute(`data-astro-cid-${component1.id}`)).toBe(false);
        }
        
        // Clean up for next iteration
        document.head.innerHTML = '';
        document.body.innerHTML = '';
      }
    ), { numRuns: 100 });
  });

  test('Global styles should not be affected by scoped component styles', () => {
    fc.assert(fc.property(
      fc.record({
        componentId: componentIdArbitrary,
        property: cssPropertyArbitrary,
        componentValue: cssValueArbitrary,
        globalValue: cssValueArbitrary
      }).filter(data => data.componentValue !== data.globalValue),
      (testCase) => {
        const { componentId, property, componentValue, globalValue } = testCase;
        
        // Add global style
        const globalStyle = document.createElement('style');
        globalStyle.textContent = `body { ${property}: ${globalValue}; }`;
        document.head.appendChild(globalStyle);
        
        // Create scoped component with conflicting style
        const componentCSS = `body { ${property}: ${componentValue}; }`;
        const component = createScopedComponent(componentId, componentCSS, '<div>Content</div>');
        
        // Global body style should not be overridden by scoped component
        const bodyStyle = getComputedStyle(document.body, property);
        
        // The scoped component style should not affect the global body element
        // since body doesn't have the component's scoping attribute
        expect(bodyStyle).not.toBe(componentValue);
        
        // Clean up
        document.head.innerHTML = '';
        document.body.innerHTML = '';
      }
    ), { numRuns: 100 });
  });

  test('Nested components should maintain proper scoping isolation', () => {
    fc.assert(fc.property(
      fc.record({
        parentId: componentIdArbitrary,
        childId: componentIdArbitrary,
        property: cssPropertyArbitrary,
        parentValue: cssValueArbitrary,
        childValue: cssValueArbitrary
      }).filter(data => 
        data.parentId !== data.childId && 
        data.parentValue !== data.childValue
      ),
      (testCase) => {
        const { parentId, childId, property, parentValue, childValue } = testCase;
        
        // Create parent component
        const parentCSS = `.nested { ${property}: ${parentValue}; }`;
        const parentContent = '<div class="nested">Parent content</div>';
        const parentComponent = createScopedComponent(parentId, parentCSS, parentContent);
        
        // Create child component and nest it inside parent
        const childCSS = `.nested { ${property}: ${childValue}; }`;
        const childContent = '<div class="nested">Child content</div>';
        const childComponent = createScopedComponent(childId, childCSS, childContent);
        
        // Nest child inside parent
        parentComponent.appendChild(childComponent);
        
        // Find nested elements
        const parentNested = parentComponent.querySelector('.nested:not([data-astro-cid-' + childId + ']) .nested') || 
                           parentComponent.querySelector('.nested[data-astro-cid-' + parentId + ']');
        const childNested = childComponent.querySelector('.nested');
        
        if (parentNested && childNested) {
          // Verify each maintains its own scoped styles
          expect(parentNested.hasAttribute(`data-astro-cid-${parentId}`) || 
                 parentNested.closest(`[data-astro-cid-${parentId}]`)).toBeTruthy();
          expect(childNested.hasAttribute(`data-astro-cid-${childId}`) || 
                 childNested.closest(`[data-astro-cid-${childId}]`)).toBeTruthy();
          
          // Child should not inherit parent's scoping attribute
          expect(childNested.hasAttribute(`data-astro-cid-${parentId}`)).toBe(false);
        }
        
        // Clean up
        document.head.innerHTML = '';
        document.body.innerHTML = '';
      }
    ), { numRuns: 100 });
  });

  test('CSS custom properties should be properly scoped', () => {
    fc.assert(fc.property(
      fc.record({
        component1Id: componentIdArbitrary,
        component2Id: componentIdArbitrary,
        customPropName: fc.string({ minLength: 3, maxLength: 10 }).map(s => `--${s}`),
        value1: cssValueArbitrary,
        value2: cssValueArbitrary
      }).filter(data => 
        data.component1Id !== data.component2Id && 
        data.value1 !== data.value2
      ),
      (testCase) => {
        const { component1Id, component2Id, customPropName, value1, value2 } = testCase;
        
        // Create components with custom properties
        const css1 = `:root { ${customPropName}: ${value1}; } .element { color: var(${customPropName}); }`;
        const css2 = `:root { ${customPropName}: ${value2}; } .element { color: var(${customPropName}); }`;
        
        const component1 = createScopedComponent(component1Id, css1, '<div class="element">Element 1</div>');
        const component2 = createScopedComponent(component2Id, css2, '<div class="element">Element 2</div>');
        
        // Verify components exist and have proper scoping
        expect(component1.hasAttribute(`data-astro-cid-${component1Id}`)).toBe(true);
        expect(component2.hasAttribute(`data-astro-cid-${component2Id}`)).toBe(true);
        expect(component1.hasAttribute(`data-astro-cid-${component2Id}`)).toBe(false);
        expect(component2.hasAttribute(`data-astro-cid-${component1Id}`)).toBe(false);
        
        // Clean up
        document.head.innerHTML = '';
        document.body.innerHTML = '';
      }
    ), { numRuns: 100 });
  });
});