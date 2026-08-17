import { describe, expect, it } from 'vitest';

import { createError } from '../src/index.js';

describe('createError', () => {
  it('exposes the planned package entry point', () => {
    expect(createError).toBeTypeOf('function');
  });
});
