import { expectTypeOf } from 'vitest';
import { z } from 'zod';

import { createError } from '@jfdevelops/create-error';

const createConsumerError = createError({
  definition: z.object({
    code: z.string(),
    scope: z.string(),
  }),
  data: {
    property: 'context',
    resolve({ definition, input }) {
      return { ...input, scope: definition.scope };
    },
  },
  message({ definition, data, implementation }) {
    return implementation({
      context: data,
      scope: definition.scope,
    });
  },
  properties({ definition, data }) {
    return {
      code: definition.code,
      context: data,
      scope: definition.scope,
    };
  },
  toJSON(error) {
    return {
      code: error.code,
      context: error.context,
      message: error.message,
      scope: error.scope,
    };
  },
});

class ConsumerError extends createConsumerError({
  code: 'consumer',
  scope: 'package',
})
  .defineContext(
    z.object({
      scope: z.literal('package'),
      value: z.string(),
    }),
  )
  .implement(({ context }) => context.value) {}

const error = new ConsumerError({ value: 'working' });

expectTypeOf(error.code).toEqualTypeOf<'consumer'>();
expectTypeOf(error.scope).toEqualTypeOf<'package'>();
expectTypeOf(error.context).toEqualTypeOf<{
  scope: 'package';
  value: string;
}>();
expectTypeOf(error.toJSON()).toEqualTypeOf<{
  code: 'consumer';
  context: {
    scope: 'package';
    value: string;
  };
  message: string;
  scope: 'package';
}>();
expectTypeOf(error).toMatchTypeOf<InstanceType<typeof createConsumerError.Error>>();
