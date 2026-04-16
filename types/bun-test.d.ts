declare module "bun:test" {
  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn: () => void | Promise<void>): void;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function expect<T>(value: T): {
    toBe(expected: T): void;
    toEqual(expected: unknown): void;
    toBeDefined(): void;
    toBeUndefined(): void;
    toBeNull(): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toBeGreaterThan(n: number): void;
    toBeGreaterThanOrEqual(n: number): void;
    toBeLessThan(n: number): void;
    toBeLessThanOrEqual(n: number): void;
    toContain(item: unknown): void;
    toHaveLength(n: number): void;
    toThrow(expected?: string | RegExp | Error): void;
    not: {
      toBe(expected: T): void;
      toEqual(expected: unknown): void;
      toBeDefined(): void;
      toBeUndefined(): void;
      toBeNull(): void;
      toBeTruthy(): void;
      toBeFalsy(): void;
      toBeGreaterThan(n: number): void;
      toThrow(expected?: string | RegExp | Error): void;
    };
  };
  export function beforeEach(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;
  export function beforeAll(fn: () => void | Promise<void>): void;
  export function afterAll(fn: () => void | Promise<void>): void;
  export function mock<T extends (...args: unknown[]) => unknown>(fn?: T): T & {
    mockReturnValue(val: ReturnType<T>): void;
    mockResolvedValue(val: Awaited<ReturnType<T>>): void;
    mockImplementation(impl: T): void;
    calls: Parameters<T>[][];
  };
  export const spyOn: <T, M extends keyof T>(obj: T, method: M) => {
    mockReturnValue(val: unknown): void;
    mockResolvedValue(val: unknown): void;
    mockImplementation(fn: (...args: unknown[]) => unknown): void;
    mockRestore(): void;
  };
}
