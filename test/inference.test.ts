import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod';

import { createError, invariant } from '../src/index.js';

describe('public inference contract', () => {
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
      if (false) {
        // @ts-expect-error serializers can only read configured error fields
        error.missing;
      }

      return {
        code: error.code,
        context: error.context,
        message: error.message,
        name: error.name,
        scope: error.scope,
      };
    },
  });

  const InvalidFieldError = createDomainError({
    code: 'invalidField',
    scope: 'field',
  })
    .defineContext(
      z.object({
        field: z.string(),
        scope: z.literal('field'),
      }),
    )
    .implement(({ code, context, scope }) => {
      expectTypeOf(code).toBeString();
      expectTypeOf(scope).toBeString();
      expectTypeOf(context).toEqualTypeOf<{
        field: string;
        scope: 'field';
      }>();
      return `${code}: ${context.field} is invalid`;
    });

  it('preserves definition, data, input, and configured property types', () => {
    const error = new InvalidFieldError({ field: 'email' });

    expectTypeOf(error.code).toBeString();
    expectTypeOf(error.scope).toBeString();
    expectTypeOf(error.context).toEqualTypeOf<{
      scope: 'field';
      field: string;
    }>();
    expectTypeOf(error.toJSON()).toEqualTypeOf<{
      code: string;
      context: {
        scope: 'field';
        field: string;
      };
      message: string;
      name: string;
      scope: string;
    }>();
    expectTypeOf(error).toMatchTypeOf<InstanceType<typeof createDomainError.Error>>();

    error.renderMessage(({ context, scope }) => {
      expectTypeOf(scope).toBeString();
      expectTypeOf(context.field).toBeString();
      return context.field;
    });
  });

  it('rejects invalid definitions and constructor inputs', () => {
    if (false) {
      // @ts-expect-error definition fields must match the schema input
      createDomainError({ code: 1, scope: 'field' });
      // @ts-expect-error definition object has an unknown field
      createDomainError({ code: 'invalidField', scope: 'field', extra: true });
      // @ts-expect-error constructor input requires field
      new InvalidFieldError({});
      // @ts-expect-error resolved scope is injected
      new InvalidFieldError({ field: 'email', scope: 'field' });
      new InvalidFieldError({ field: 'email' }).renderMessage(
        // @ts-expect-error renderer must accept this concrete error context
        (_argument: {
          context: { scope: 'other'; field: string };
          scope: 'field';
        }) => 'invalid',
      );
      const contextBuilder = createDomainError({
        code: 'invalidField',
        scope: 'field',
      }).defineContext(z.object({ field: z.string() }));
      // @ts-expect-error defining context returns only the implementation builder
      contextBuilder.defineContext(z.object({ field: z.string() }));
      contextBuilder.implement(
        // @ts-expect-error implementations receive exactly one argument
        (_argument, _extraArgument) => 'invalid',
      );
    }
  });

  it('preserves restricted schema literals without const assertions', () => {
    const createHttpError = createError({
      definition: z.object({
        code: z.enum(['notFound', 'unauthorized']),
      }),
      data: { property: 'data', resolve: ({ input }) => input },
      message: () => 'http error',
    });

    createHttpError({ code: 'notFound' });
    createHttpError({ code: 'unauthorized' });
    if (false) {
      // @ts-expect-error code is outside the schema type
      createHttpError({ code: 'forbidden' });
    }
  });

  it('uses transformed definition output instead of input literals', () => {
    const createTransformedError = createError({
      definition: z.object({ code: z.string() }).transform(({ code }) => ({
        code: code.toUpperCase(),
      })),
      data: { property: 'data', resolve: ({ input }) => input },
      message: () => 'transformed',
      properties: ({ definition }) => ({ code: definition.code }),
    });
    const TransformedError = createTransformedError({
      code: 'mixedCase',
    }).implement(() => 'transformed');
    const error = new TransformedError(undefined);

    expectTypeOf(error.code).toBeString();
    if (false) {
      // @ts-expect-error parsed output is not the original input literal
      const inputCode: 'mixedCase' = error.code;
      expectTypeOf(inputCode).toEqualTypeOf<'mixedCase'>();
    }
  });

  it('supports non-object data without widening it', () => {
    const definition = z.object({ code: z.string() });

    const createScalarError = createError({
      definition,
      data: { property: 'data', resolve: ({ input }) => input },
      message: ({ implementation, data }) => implementation(data),
    });
    const ScalarError = createScalarError({ code: 'scalar' })
      .defineContext(z.string())
      .implement((data) => data);
    expectTypeOf(new ScalarError('value').data).toBeString();

    const TupleError = createScalarError({ code: 'tuple' })
      .defineContext(z.tuple([z.string(), z.number()]).readonly())
      .implement((data) => data.join(':'));
    expectTypeOf(new TupleError(['value', 1]).data).toEqualTypeOf<
      readonly [string, number]
    >();

    const NullableError = createScalarError({ code: 'nullable' })
      .defineContext(z.union([z.null(), z.undefined()]))
      .implement((data) => String(data));
    expectTypeOf(new NullableError(null).data).toEqualTypeOf<null | undefined>();
  });

  it('infers serialized data without configured properties', () => {
    const createJsonError = createError({
      definition: z.object({ code: z.string() }),
      data: { property: 'payload', resolve: ({ input }) => input },
      message: ({ data, implementation }) => implementation(data),
      toJSON(error) {
        return {
          message: error.message,
          payload: error.payload,
        };
      },
    });
    const JsonError = createJsonError({ code: 'json' })
      .defineContext(z.object({ value: z.string() }))
      .implement(({ value }) => value);

    expectTypeOf(new JsonError({ value: 'typed' }).toJSON()).toEqualTypeOf<{
      message: string;
      payload: { value: string };
    }>();
  });

  it('accepts a class name option', () => {
    const createLookupError = createError({
      definition: z.object({ code: z.string() }),
      data: { property: 'resourceId', resolve: ({ input }) => input },
      message: ({ data, implementation }) => implementation(data),
    });
    const MissingResourceError = createLookupError({ code: 'missingResource' })
      .defineContext(z.string())
      .implement((resourceId) => `${resourceId} was not found`, {
        name: 'MissingResourceError',
      });

    expectTypeOf(new MissingResourceError('resource').resourceId).toBeString();
    if (false) {
      createLookupError({ code: 'missingResource' }).implement(
        (resourceId: string) => resourceId,
        // @ts-expect-error name must be a string
        { name: 1 },
      );
    }
  });

  it('passes built-in class instances without definition fields', () => {
    const createInstanceError = createError({
      definition: z.object({ code: z.string() }),
      data: { property: 'data', resolve: ({ input }) => input },
      message: ({ implementation }) =>
        implementation({
          occurredAt: new Date(),
          tags: new Map<string, number>(),
        }),
      properties: () => ({ createdAt: new Date() }),
      toJSON: (error) => ({ createdAt: error.createdAt }),
    });
    const createDateError = createError({
      definition: z.object({ code: z.string() }),
      data: { property: 'data', resolve: ({ input }) => input },
      message: ({ implementation }) => implementation(new Date()),
    });

    const InstanceError = createInstanceError({ code: 'instance' }).implement(
      ({ code, occurredAt, tags }) => {
        expectTypeOf(code).toBeString();
        expectTypeOf(occurredAt).toEqualTypeOf<Date>();
        expectTypeOf(tags).toEqualTypeOf<Map<string, number>>();
        return `${code} ${tags.size}`;
      },
    );
    const DateError = createDateError({ code: 'date' }).implement((date) => {
      expectTypeOf(date).toEqualTypeOf<Date>();
      if (false) {
        // @ts-expect-error class instances do not receive definition fields
        date.code;
      }
      return date.toISOString();
    });

    expectTypeOf(new InstanceError(undefined).createdAt).toEqualTypeOf<Date>();
    expectTypeOf(new InstanceError(undefined).toJSON()).toEqualTypeOf<{
      createdAt: Date;
    }>();
    expectTypeOf(new DateError(undefined).message).toBeString();
  });

  it('narrows with the standalone invariant on const classes', () => {
    const createLookupError = createError({
      definition: z.object({ code: z.string() }),
      data: { property: 'resourceId', resolve: ({ input }) => input },
      message: ({ data, implementation }) => implementation(data),
    });
    const MissingResourceError = createLookupError({ code: 'missingResource' })
      .defineContext(z.string())
      .implement((resourceId) => `${resourceId} was not found`);
    const requireResource = (resource: { id: string } | undefined) => {
      invariant(MissingResourceError, resource, () => 'resource_123');
      expectTypeOf(resource).toEqualTypeOf<{ id: string }>();
    };

    requireResource({ id: 'resource_123' });
    if (false) {
      // @ts-expect-error input must match the constructor input
      invariant(MissingResourceError, true, 1);
    }
  });

  it('requires wrapped input when constructor input is a function', () => {
    const createCallbackError = createError({
      definition: z.object({ code: z.string() }),
      data: { property: 'callback', resolve: ({ input }) => input },
      message: ({ data, implementation }) => implementation(data),
    });
    class CallbackError extends createCallbackError({
      code: 'callback',
    }).implement((_callback: () => string) => 'callback failed') {}
    const handler = () => 'value';

    expectTypeOf(new CallbackError(handler).callback).toEqualTypeOf<
      () => string
    >();
    if (false) {
      // @ts-expect-error function constructor input keeps its call signature
      new CallbackError({});
      CallbackError.invariant(false, () => handler);
      invariant(CallbackError, false, () => handler);
      // @ts-expect-error a callback would be called as lazy input
      CallbackError.invariant(false, handler);
      // @ts-expect-error a callback would be called as lazy input
      invariant(CallbackError, false, handler);
    }
  });
});
