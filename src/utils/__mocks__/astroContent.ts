export const z = {
  object: () => ({
    parse: jest.fn(),
    optional: () => ({ parse: jest.fn() }),
  }),
  string: () => ({
    default: jest.fn().mockReturnThis(),
    optional: () => ({ parse: jest.fn() }),
  }),
  array: () => ({ default: jest.fn() }),
  boolean: () => ({ optional: jest.fn().mockReturnThis() }),
  date: () => ({ optional: jest.fn().mockReturnThis() }),
  // Add other z methods as needed
}

export class ZodError extends Error {
  format() {
    return {};
  }
}