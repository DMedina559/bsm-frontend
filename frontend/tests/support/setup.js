import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock fetch globally
globalThis.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(""),
  }),
);

// Mock WebSocket
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0;
  }
  send = vi.fn();
  close = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
}
globalThis.WebSocket = MockWebSocket;

// Mock LocalStorage
const localStorageMock = (function () {
  let store = {};
  return {
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index) => Object.keys(store)[index] ?? null),
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();
Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
});

const sessionStorageMock = (function () {
  let store = {};
  return {
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index) => Object.keys(store)[index] ?? null),
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();
Object.defineProperty(globalThis, "sessionStorage", {
  value: sessionStorageMock,
});

// Mock ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock vite define globals
globalThis.__APP_VERSION__ = "test-version";
