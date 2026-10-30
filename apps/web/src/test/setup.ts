import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

/**
 * Testing Library only auto-registers cleanup when Vitest globals are enabled;
 * this project keeps globals off, so unmount explicitly to keep assertions
 * scoped to a single render.
 */
afterEach(() => {
  cleanup();
});

/**
 * jsdom lacks the browser APIs the cinematic shell relies on. They are stubbed
 * narrowly (only what the components touch) so component tests exercise real
 * logic instead of crashing on missing platform features.
 */
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

class IntersectionObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): [] {
    return [];
  }
}

Object.defineProperty(globalThis, 'ResizeObserver', { value: ResizeObserverStub, writable: true });
Object.defineProperty(globalThis, 'IntersectionObserver', {
  value: IntersectionObserverStub,
  writable: true,
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

Object.defineProperty(window, 'scrollTo', { value: () => {}, writable: true });

if (!('requestAnimationFrame' in window)) {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  Object.defineProperty(window, 'requestAnimationFrame', { value: () => 0, writable: true });
}
