import "@testing-library/jest-dom";

// Mock Tauri APIs in test environment
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  open: vi.fn(),
}));
