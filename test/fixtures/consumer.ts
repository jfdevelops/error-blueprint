import { expectTypeOf } from 'vitest';
import { z } from 'zod';

import {
  createError,
  type CreateErrorConfig,
} from '@jfdevelops/create-error';

const reusableDefinition = z.object({ code: z.string() });
const reusableConfig = {
  definition: reusableDefinition,
  data: {
    property: 'context',
    resolve: ({ input }) => input,
  },
  message: ({ data, implementation }) => implementation(data),
} satisfies CreateErrorConfig<typeof reusableDefinition>;

createError(reusableConfig);

const createLookupError = createError({
  definition: z.object({ code: z.string() }),
  data: { property: 'resourceId', resolve: ({ input }) => input },
  message: ({ data, implementation }) => implementation(data),
});
const MissingResourceError = createLookupError({
  code: 'missingResource',
})
  .defineContext(z.string())
  .implement((resourceId) => `${resourceId} was not found`);

expectTypeOf(new MissingResourceError('resource_123').resourceId).toBeString();

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
  .implement(({ code, context }) => `${code}: ${context.value}`) {}

const error = new ConsumerError({ value: 'working' });

expectTypeOf(error.code).toBeString();
expectTypeOf(error.scope).toBeString();
expectTypeOf(error.context).toEqualTypeOf<{
  scope: 'package';
  value: string;
}>();
expectTypeOf(error.toJSON()).toEqualTypeOf<{
  code: string;
  context: {
    scope: 'package';
    value: string;
  };
  message: string;
  scope: string;
}>();
expectTypeOf(error).toMatchTypeOf<InstanceType<typeof createConsumerError.Error>>();
