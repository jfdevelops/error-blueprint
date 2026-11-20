---
title: Quick start
description: Create, throw, and catch a family of typed errors.
order: 30
---

Create a family with shared validation and behavior, then define errors with their own context and message.

In this guide you will:

- Configure a reusable error family.
- Define a concrete class with validated context.
- Throw and catch typed errors.

## Configure a family

A blueprint describes the parts all errors in a family share. Definitions are
class-level metadata; context is the data supplied for an individual instance.

```ts
import { createError } from '@jfdevelops/create-error';
import { z } from 'zod';

export const createRequestError = createError({
  definition: z.object({ code: z.string() }),
  data: {
    property: 'context',
    resolve: ({ input }) => input,
  },
  message: ({ data, implementation }) => implementation(data),
  properties: ({ definition }) => ({ code: definition.code }),
});
```

`data.resolve` runs for every instance. Here it forwards constructor input
unchanged. The resolved value is validated by the concrete context schema, then
stored as `error.context`. `message` delegates to the concrete implementation.
`properties` exposes the parsed definition's `code` on the error instance.

## Define a concrete error

```ts
export class MissingUserError extends createRequestError({ code: 'missingUser' })
  .defineContext(z.object({ userId: z.string() }))
  .implement(({ userId }) => `User ${userId} was not found`) {}

const error = new MissingUserError({ userId: 'user_123' });

error.name; // "MissingUserError"
error.message; // "User user_123 was not found"
error.code; // string
error.context.userId; // string
error instanceof Error; // true
error instanceof createRequestError.Error; // true
```

The definition is validated when `createRequestError({ code: 'missingUser' })`
runs. Context is validated each time you construct an instance. Both schemas
must validate synchronously. A validation failure throws a `TypeError` rather
than creating a domain error.

No generic arguments or `as const` assertions are required. Definition-derived
fields follow the definition schema's output type, so `z.string()` gives
`error.code` the type `string`. Use a literal or enum schema to restrict it.

If you assign the generated class to a variable instead of extending it with a
named class, supply its name explicitly:

```ts
const MissingOrderError = createRequestError({ code: 'missingOrder' })
  .defineContext(z.object({ orderId: z.string() }))
  .implement(({ orderId }) => `Order ${orderId} was not found`, {
    name: 'MissingOrderError',
  });
```

## Throw and catch

```ts
function findUser(userId: string) {
  throw new MissingUserError({ userId });
}

try {
  findUser('user_123');
} catch (error) {
  if (error instanceof MissingUserError) {
    console.log(error.context.userId);
  } else if (createRequestError.is(error)) {
    console.log(error.code, error.message);
  } else {
    throw error;
  }
}
```

A concrete class check preserves its specific context type. The family guard
narrows to shared properties, with context typed as `unknown`. It uses
`instanceof`, so a separately created family or a deserialized object does not
match.

## Next steps

- [Customize a blueprint](guides/customize-errors.md).
- [Use causes, context transforms, and invariants](guides/recipes.md).
- [Browse the generated API reference](reference/index.md).
