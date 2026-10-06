import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createError } from '../src/index.js';

describe('definition schema', () => {
  it('accepts a Standard Schema object and validates definitions', () => {
    const definition = z.object({
      active: z.boolean(),
      code: z.enum(['notFound', 'unauthorized']),
      count: z.number(),
      label: z.string(),
    });
    const createConfiguredError = createError({
      definition,
      data: { property: 'data', resolve: ({ input }) => input },
      message: () => 'configured',
    });

    expect(() =>
      createConfiguredError({
        active: true,
        code: 'notFound',
        count: 1,
        label: 'label',
      }),
    ).not.toThrow();
    expect(() =>
      createConfiguredError({
        active: true,
        code: 'forbidden',
        count: 1,
        label: 'label',
      } as never),
    ).toThrow(/Invalid error definition: code:/);
  });

  it('rejects asynchronous schemas clearly', () => {
    const asyncSchema = z.object({ code: z.string() }).refine(async () => true);
    const createConfiguredError = createError({
      definition: asyncSchema,
      data: { property: 'data', resolve: ({ input }) => input },
      message: () => 'message',
    });

    expect(() => createConfiguredError({ code: 'invalid' })).toThrow(
      'definition schema validation must be synchronous',
    );
  });

  it('uses the parsed schema output in blueprint callbacks', () => {
    const definition = z.object({ code: z.string() }).transform((input) => {
      const normalizedCode = input.code.toUpperCase();

      return {
        code: normalizedCode,
        normalizedCode,
      };
    });
    const createConfiguredError = createError({
      definition,
      data: { property: 'data', resolve: ({ input }) => input },
      message: () => 'configured',
      properties: ({ definition }) => ({
        code: definition.code,
        normalizedCode: definition.normalizedCode,
      }),
    });
    const ConfiguredError = createConfiguredError({
      code: 'mixedCase',
    }).implement(() => 'configured');
    const error = new ConfiguredError(undefined);

    expect(error.code).toBe('MIXEDCASE');
    expect(error.normalizedCode).toBe('MIXEDCASE');
  });
});

describe('error factory', () => {
  const createDomainError = createError({
    definition: z.object({ code: z.string(), scope: z.string() }),
    data: {
      property: 'context',
      resolve({ definition, input }) {
        return {
          ...input,
          scope: definition.scope,
        };
      },
    },
    message({ definition, data, implementation }) {
      return implementation({
        context: data,
        scope: definition.scope,
      });
    },
    properties({ definition, data, implementation }) {
      return {
        code: definition.code,
        scope: definition.scope,
        context: data,
        renderMessage(renderer = implementation) {
          return renderer({
            context: data,
            scope: definition.scope,
          });
        },
      };
    },
    toJSON(error) {
      return {
        code: error.code,
        context: error.context,
        message: error.message,
        name: error.name,
        scope: error.scope,
      };
    },
  });

  const InvalidFieldBase = createDomainError({
    code: 'invalidField',
    scope: 'field',
  })
    .defineContext(
      z.object({
        field: z.string(),
        scope: z.literal('field'),
      }),
    )
    .implement(({ code, context }) => `${code}: ${context.field} is invalid`);

  class InvalidFieldError extends InvalidFieldBase {}

  it('creates native, family, generated, and named subclass instances', () => {
    const error = new InvalidFieldError({ field: 'email' });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(createDomainError.Error);
    expect(error).toBeInstanceOf(InvalidFieldBase);
    expect(error).toBeInstanceOf(InvalidFieldError);
    expect(error.name).toBe('InvalidFieldError');
    expect(error.message).toBe('invalidField: email is invalid');
    expect(error.code).toBe('invalidField');
    expect(error.scope).toBe('field');
    expect(error.context).toEqual({ field: 'email', scope: 'field' });
    expect(error.renderMessage(({ context }) => context.field)).toBe('email');
  });

  it('exposes both builder paths and narrows after defining context', () => {
    const definitionBuilder = createDomainError({
      code: 'builder',
      scope: 'field',
    });
    const contextBuilder = definitionBuilder.defineContext(
      z.object({
        field: z.string(),
        scope: z.literal('field'),
      }),
    );

    expect(definitionBuilder.defineContext).toBeTypeOf('function');
    expect(definitionBuilder.implement).toBeTypeOf('function');
    expect(contextBuilder.implement).toBeTypeOf('function');
    expect('defineContext' in contextBuilder).toBe(false);
  });

  it('validates resolved context with the selected schema', () => {
    expect(() => new InvalidFieldError({ field: 1 } as never)).toThrow(
      /Invalid error context: field:/,
    );
  });

  it('parses context between data resolution and message creation', () => {
    const calls: string[] = [];
    const createContextError = createError({
      definition: z.object({ code: z.string() }),
      data: {
        property: 'context',
        resolve({ input }) {
          calls.push('resolve');
          return input;
        },
      },
      message({ data, implementation }) {
        calls.push('message');
        return implementation(data);
      },
      properties({ data }) {
        calls.push('properties');
        return { context: data };
      },
    });
    const ContextError = createContextError({ code: 'context' })
      .defineContext(
        z
          .object({
            value: z.string(),
          })
          .transform(({ value }) => {
            calls.push('context');

            return {
              length: value.length,
              value,
            };
          }),
      )
      .implement((context) => String(context.length));
    const error = new ContextError({ value: 'three' });

    expect(error.message).toBe('5');
    expect(error.context).toEqual({ length: 5, value: 'three' });
    expect(calls).toEqual(['resolve', 'context', 'message', 'properties']);
  });

  it('rejects asynchronous context schemas clearly', () => {
    const createContextError = createError({
      definition: z.object({ code: z.string() }),
      data: { property: 'context', resolve: ({ input }) => input },
      message: () => 'context error',
    });
    const ContextError = createContextError({ code: 'context' })
      .defineContext(z.object({ value: z.string() }).refine(async () => true))
      .implement(() => 'context error');

    expect(() => new ContextError({ value: 'value' })).toThrow(
      'context schema validation must be synchronous',
    );
  });

  it('preserves cause and custom JSON serialization', () => {
    const cause = new Error('root cause');
    const error = new InvalidFieldError({ field: 'email' }, { cause });

    expect(error.cause).toBe(cause);
    expect(error.toJSON()).toEqual({
      code: 'invalidField',
      context: { field: 'email', scope: 'field' },
      message: 'invalidField: email is invalid',
      name: 'InvalidFieldError',
      scope: 'field',
    });
    expect(JSON.parse(JSON.stringify(error))).toEqual(error.toJSON());
  });

  it('evaluates invariant input lazily', () => {
    const createInput = vi.fn(() => ({ field: 'email' }));

    InvalidFieldError.invariant(true, createInput);
    expect(createInput).not.toHaveBeenCalled();

    expect(() => InvalidFieldError.invariant(false, createInput)).toThrow(
      InvalidFieldError,
    );
    expect(createInput).toHaveBeenCalledTimes(1);
  });

  it('uses one family base for multiple definitions', () => {
    const OtherError = createDomainError({ code: 'other', scope: 'form' })
      .defineContext(
        z.object({
          form: z.string(),
          scope: z.literal('form'),
        }),
      )
      .implement(({ context }) => context.form);

    expect(new OtherError({ form: 'signup' })).toBeInstanceOf(
      createDomainError.Error,
    );
  });

  it('does not add toJSON unless configured', () => {
    const createPlainError = createError({
      definition: z.object({ code: z.string() }),
      data: { property: 'data', resolve: ({ input }) => input },
      message: ({ implementation, data }) => implementation(data),
    });
    const PlainError = createPlainError({ code: 'plain' }).implement(
      (data: string) => data,
    );
    const error = new PlainError('plain message');

    expect('toJSON' in error).toBe(false);
    expect(error.message).toBe('plain message');
  });

  it.each([
    ['scalar', 'value'],
    ['tuple', ['value', 1]],
    ['union object', { kind: 'object' }],
    ['null', null],
    ['undefined', undefined],
  ])('preserves %s data', (_label, value) => {
    const createDataError = createError({
      definition: z.object({ code: z.string() }),
      data: { property: 'data', resolve: ({ input }) => input },
      message: () => 'data error',
      properties: ({ data }) => ({ data }),
    });
    const DataError = createDataError({ code: 'data' }).implement(
      (_data: unknown) => 'data error',
    );

    expect(new DataError(value).data).toBe(value);
  });

  it('preserves class-instance data', () => {
    class Details {
      constructor(readonly value: string) {}
    }

    const createDataError = createError({
      definition: z.object({ code: z.string() }),
      data: { property: 'data', resolve: ({ input }) => input },
      message: () => 'data error',
      properties: ({ data }) => ({ data }),
    });
    const DataError = createDataError({ code: 'data' }).implement(
      (_data: Details) => 'data error',
    );
    const details = new Details('value');

    expect(new DataError(details).data).toBe(details);
  });

  it('preserves plain-object data forwarded directly to implementation', () => {
    const implementation = vi.fn(() => 'data error');
    const createDataError = createError({
      definition: z.object({ code: z.string() }),
      data: { property: 'data', resolve: ({ input }) => input },
      message: ({ data, implementation: render }) => render(data),
    });
    const DataError = createDataError({ code: 'data' }).implement(
      implementation,
    );
    const data = { value: 'original' };

    new DataError(data);

    expect(implementation).toHaveBeenCalledWith(data);
  });

  it('rejects protected and conflicting properties', () => {
    expect(() =>
      createError({
        definition: z.object({ code: z.string() }),
        data: { property: 'message', resolve: ({ input }) => input },
        message: () => 'message',
      }),
    ).toThrow('data.property cannot overwrite protected property "message"');

    const createConflictingError = createError({
      definition: z.object({ code: z.string() }),
      data: { property: 'data', resolve: ({ input }) => input },
      message: () => 'message',
      properties: () => ({ message: 'replacement' }),
    });
    const ConflictingError = createConflictingError({
      code: 'conflict',
    }).implement(() => 'message');

    expect(() => new ConflictingError(undefined)).toThrow(
      'Cannot overwrite protected error property "message"',
    );
  });

  it('preserves callback exceptions by identity', () => {
    const failure = new Error('resolver failed');
    const createFailingError = createError({
      definition: z.object({ code: z.string() }),
      data: {
        property: 'data',
        resolve() {
          throw failure;
        },
      },
      message: () => 'unreachable',
    });
    const FailingError = createFailingError({ code: 'failure' }).implement(
      () => 'unreachable',
    );

    expect(() => new FailingError(undefined)).toThrow(failure);
  });
});
