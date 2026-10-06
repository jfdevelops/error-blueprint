import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod';

import { createError } from '../src/index.js';

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
      expectTypeOf(code).toEqualTypeOf<'invalidField'>();
      expectTypeOf(scope).toEqualTypeOf<'field'>();
      expectTypeOf(context).toEqualTypeOf<{
        field: string;
        scope: 'field';
      }>();
      return `${code}: ${context.field} is invalid`;
    });

  it('preserves definition, data, input, and configured property types', () => {
    const error = new InvalidFieldError({ field: 'email' });

    expectTypeOf(error.code).toEqualTypeOf<'invalidField'>();
    expectTypeOf(error.scope).toEqualTypeOf<'field'>();
    expectTypeOf(error.context).toEqualTypeOf<{
      scope: 'field';
      field: string;
    }>();
    expectTypeOf(error.toJSON()).toEqualTypeOf<{
      code: 'invalidField';
      context: {
        scope: 'field';
        field: string;
      };
      message: string;
      name: string;
      scope: 'field';
    }>();
    expectTypeOf(error).toMatchTypeOf<InstanceType<typeof createDomainError.Error>>();

    error.renderMessage(({ context, scope }) => {
      expectTypeOf(scope).toEqualTypeOf<'field'>();
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

  it('supports non-object data without widening it', () => {
    const definition = z.object({ code: z.string() });

    const createScalarError = createError({
      definition,
      data: { property: 'data', resolve: ({ input }) => input },
      message: ({ implementation, data }) => implementation(data),
      properties: ({ data }) => ({ data }),
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
});
