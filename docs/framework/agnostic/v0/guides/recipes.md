---
title: Recipes
description: Normalize data, preserve causes, serialize errors, and assert conditions.
order: 20
---

Use constructor normalization, context transformations, causes, serialization, and assertions to adapt errors to your application.

In this guide you will:

- Normalize constructor input.
- Transform validated context.
- Preserve causes and choose JSON fields.
- Assert conditions with lazy error data.

## Normalize input with definition values

Use `data.resolve` to add shared metadata before context validation. The
constructor only needs the fields that were not supplied from the definition.

```ts
import { createError } from '@jfdevelops/create-error';
import { z } from 'zod';

const createFieldError = createError({
  definition: z.object({ section: z.literal('profile') }),
  data: {
    property: 'context',
    resolve: ({ definition, input }) => ({
      ...input,
      section: definition.section,
    }),
  },
  message: ({ data, implementation }) => implementation(data),
});

class InvalidFieldError extends createFieldError({ section: 'profile' })
  .defineContext(z.object({ field: z.string(), section: z.literal('profile') }))
  .implement(({ field, section }) => `${section}.${field} is invalid`) {}

const error = new InvalidFieldError({ field: 'email' });
error.context.section; // "profile"
```

## Transform context

The constructor accepts the context schema's input, and the implementation and
stored property receive its parsed output. This example stands alone.

```ts
import { createError } from '@jfdevelops/create-error';
import { z } from 'zod';

const createLookupError = createError({
  definition: z.object({ code: z.string() }),
  data: {
    property: 'resourceId',
    resolve: ({ input }) => input,
  },
  message: ({ data, implementation }) => implementation(data),
});

class MissingResourceError extends createLookupError({ code: 'missingResource' })
  .defineContext(z.string().trim().transform((value) => Number(value)))
  .implement((resourceId) => `Resource ${resourceId} was not found`) {}

const error = new MissingResourceError(' 42 ');
error.resourceId; // 42 (number)
```

Without `defineContext`, the same factory can infer data from an annotated
implementation parameter. This does not validate input at runtime:

```ts
class MissingSlugError extends createLookupError({ code: 'missingSlug' })
  .implement((slug: string) => `Resource ${slug} was not found`) {}

new MissingSlugError('welcome');
```

## Preserve a cause and serialize selected fields

Choose an explicit JSON representation when sending errors to logs or clients.
Native `Error` fields are not all enumerable. Without a configured `toJSON`,
ordinary JSON serialization follows the instance's enumerable properties.

```ts
import { createError } from '@jfdevelops/create-error';
import { z } from 'zod';

const createServiceError = createError({
  definition: z.object({ code: z.string() }),
  data: {
    property: 'context',
    resolve: ({ input }) => input,
  },
  message: ({ data, implementation }) => implementation(data),
  properties: ({ definition }) => ({ code: definition.code }),
  toJSON: (error) => ({
    name: error.name,
    code: error.code,
    message: error.message,
  }),
});

class UnavailableError extends createServiceError({ code: 'unavailable' })
  .defineContext(z.object({ service: z.string() }))
  .implement(({ service }) => `${service} is unavailable`) {}

const cause = new Error('Connection refused');
const error = new UnavailableError({ service: 'billing' }, { cause });

error.cause === cause; // true
JSON.stringify(error);
// {"name":"UnavailableError","code":"unavailable","message":"billing is unavailable"}
```

The serializer above deliberately selects public fields. Include context, cause,
or stack only if they belong in your serialized contract. Parsing the JSON does
not create an `UnavailableError` instance.

## Assert a condition

Using `UnavailableError` from the preceding example:

```ts
function requireService(service: { name: string } | undefined) {
  UnavailableError.invariant(service, () => ({ service: 'billing' }));

  return service.name;
}
```

`service` is narrowed after the assertion, and the context producer runs only
when it is missing. For a generated class stored in a variable, use the
standalone assertion function:

```ts
import { invariant } from '@jfdevelops/create-error';

const OfflineError = createServiceError({ code: 'offline' })
  .defineContext(z.object({ service: z.string() }))
  .implement(({ service }) => `${service} is offline`, { name: 'OfflineError' });

function requireConnection(connection: { id: string } | undefined) {
  invariant(OfflineError, connection, () => ({ service: 'billing' }));

  return connection.id;
}
```

## Next steps

- [Customize shared behavior](customize-errors.md).
- [Inspect the generated API](../reference/index.md).
