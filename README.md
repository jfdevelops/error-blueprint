# @jfdevelops/create-error

Create strongly typed, configurable error families from any synchronous
[Standard Schema](https://standardschema.dev/schema) object.

## Install

```sh
pnpm add @jfdevelops/create-error
```

Bring your own Standard Schema-compatible validation library, such as Zod,
Valibot, or ArkType. `create-error` does not bundle one.

## Quick start

```ts
import { createError } from '@jfdevelops/create-error';
import { z } from 'zod';

const createFormError = createError({
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
      name: error.name,
      code: error.code,
      scope: error.scope,
      message: error.message,
      context: error.context,
    };
  },
});

export const FormError = createFormError.Error;

export class InvalidFieldError extends createFormError({
  code: 'invalidField',
  scope: 'field',
})
  .defineContext(
    z.object({
      field: z.string(),
      scope: z.literal('field'),
    }),
  )
  .implement(
    ({ context }) => `${context.field} is invalid`,
  ) {}

const error = new InvalidFieldError({ field: 'email' });

error.code; // "invalidField"
error.scope; // "field"
error.context; // { field: string; scope: "field" }
error instanceof Error; // true
error instanceof FormError; // true
```

No explicit generic arguments or `as const` assertions are needed. Concrete
definition values remain literals when they are compatible with the schema's
parsed output.

## How the factory works

The API has four stages:

1. `createError(blueprint)` configures a family and returns a factory.
2. `factory(definition)` validates and captures one definition.
3. The returned builder optionally selects a context schema with
   `defineContext(schema)`.
4. `implement(callback)` captures the implementation and produces an
   extendable concrete error class.

The definition builder exposes both `defineContext` and `implement`.
`defineContext` returns a narrower builder that exposes only `implement`, so a
context schema can be selected only once. Calling `implement` directly keeps
context schemas optional. Every implementation receives exactly one argument;
the blueprint decides its shape when it calls `implementation(argument)`.

The `definition` option must implement Standard Schema V1 and must produce an
object. Validation runs when `factory(definition)` is called. Because class
creation is synchronous, a schema whose `validate` method returns a promise is
rejected with a `TypeError`.

Use schema-native restrictions when definitions have a closed set of values:

```ts
const createHttpError = createError({
  definition: z.object({
    code: z.enum(['notFound', 'unauthorized']),
    scope: z.literal('request'),
  }),
  data: {
    property: 'details',
    resolve: ({ input }) => input,
  },
  message: ({ implementation, data }) => implementation(data),
});

const NotFoundError = createHttpError({
  code: 'notFound',
  scope: 'request',
})
  .defineContext(z.object({ resource: z.string() }))
  .implement((details) => `${details.resource} was not found`);
```

## Data and behavior

`data.resolve` can return any value: objects, scalars, tuples, unions, class
instances, `null`, and `undefined` are all supported. When `defineContext` is
used, its Standard Schema validates the resolved data, its input type determines
the concrete error constructor input, and its output type is passed to the
implementation and stored on the error. Without a context schema, the last
parameter of the consumer implementation determines those types.

For each new error instance, callbacks run in this order:

1. `data.resolve`
2. Context validation and transformation, when configured
3. `message`
4. `properties`, when configured

Exceptions thrown by a schema or callback are not wrapped. Native `Error`
behavior is preserved, including stack traces, subclass names, prototypes, and
the optional `cause` passed as the second constructor argument.

Every family exposes its shared base as `factory.Error`. Concrete classes and
named subclasses also inherit a lazy invariant helper:

```ts
InvalidFieldError.invariant(
  formIsValid,
  () => ({ field: 'email' }),
  { cause },
);
```

The input function runs only when the condition is falsy.

When `toJSON` is configured, it is installed once on the family prototype and
used by `JSON.stringify`. When omitted, the family does not add a `toJSON`
method.

## Property safety

`properties` may add fields, methods, getters, symbols, and other own property
descriptors. It cannot replace `name`, `message`, `stack`, `cause`,
`constructor`, or `prototype`. The configured data property may only be
repeated with the exact resolved value. Collisions throw a `TypeError`.

The library always creates the family base class. Customize a family through
the blueprint instead of supplying a separate `BaseError`.

## Releasing

This project uses Changesets for versioning and changelogs. Add a changeset
with `pnpm changeset` whenever a package change should be released. Maintainers
can consume pending changesets with `pnpm version-packages`, review the updated
version and changelog, then publish with `pnpm release`.

## License

MIT
