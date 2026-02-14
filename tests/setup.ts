import { beforeAll } from 'vitest';

beforeAll(() => {
  if (typeof (globalThis as any).CSS === 'undefined' || typeof (globalThis as any).CSS.escape !== 'function') {
    (globalThis as any).CSS = {
      escape: (str: string) => {
        return str.replace(/([^\w-])/g, '\\$1');
      },
    };
  }
});
