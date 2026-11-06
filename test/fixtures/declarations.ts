import { z } from 'zod';

import { createError } from '@jfdevelops/create-error';

export const createPackageError = createError({
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
});

export const PackageError = createPackageError.Error;

export class MissingValueError extends createPackageError({
  code: 'missingValue',
  scope: 'package',
})
  .defineContext(
    z.object({
      scope: z.literal('package'),
      value: z.string(),
    }),
  )
  .implement(({ code, context }) => `${code}: ${context.value}`) {}
