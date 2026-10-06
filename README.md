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
    ({ code, context }) => `${code}: ${context.field} is invalid`,
  ) {}

const error = new InvalidFieldError({ field: 'email' });

error.code; // "invalidField"
error.scope; // "field"
error.context; // { field: string; scope: "field" }
error instanceof Error; // true
error instanceof FormError; // true
```

No explicit generic arguments or `as const` assertions are needed. Definition
inputs are checked by the schema, and definition-derived fields use its parsed
output type so transformations remain type-safe.

For reusable or separately declared configurations, the package exports a
common `CreateErrorConfig` type:

```ts
import { createError, type CreateErrorConfig } from '@jfdevelops/create-error';

const definition = z.object({ code: z.string() });

const config = {
  definition,
  data: {
    property: 'context',
    resolve: ({ input }) => input,
  },
  message: ({ data, implementation }) => implementation(data),
} satisfies CreateErrorConfig<typeof definition>;

const createDomainError = createError(config);
```

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
the blueprint decides its shape when it calls `implementation(argument)`. When
that argument is a constructed object, the concrete definition fields are added
automatically, so implementations can read values such as `code` without the
blueprint repeating them. Forwarding opaque data directly preserves its original
scalar, tuple, object, or class-instance shape.

The `definition` option must implement Standard Schema V1 and must produce an
object. Validation runs when `factory(definition)` is called. Because class
creation is synchronous, a schema whose `validate` method returns a promise or
other thenable is rejected with a `TypeError`. `createError` also checks that
`data.resolve`, `message`, and any `properties` or `toJSON` options are
functions.

## What `data` and `properties` do

`data` defines the constructor-input lifecycle. Its `resolve` callback receives
the concrete definition and the value passed to `new ErrorClass(input)`. The
callback can preserve that input, normalize it, or combine it with definition
values. After optional `defineContext` validation, the final value is stored on
the instance using `data.property`.

`properties` defines the rest of the instance API. It can expose definition
values such as a stable error code, pass the resolved data through, or add
methods and getters. It does not participate in input validation or
transformation. Because each concrete error types its data separately, the
blueprint can store `data` but cannot read its fields; derive values from
`definition` or call `implementation(data)` instead.

For a small error family, the constructor input can pass straight through and
`properties` can be omitted entirely:

```ts
const createLookupError = createError({
  definition: z.object({ code: z.string() }),
  data: {
    property: 'resourceId',
    resolve: ({ input }) => input,
  },
  message: ({ data, implementation }) => implementation(data),
});

class MissingUserError extends createLookupError({ code: 'missingUser' })
  .defineContext(z.string())
  .implement((resourceId) => `User ${resourceId} was not found`) {}

const error = new MissingUserError('user_123');
error.resourceId; // string
```

Use both options when constructor input needs normalization and the error should
present a richer public API:

```ts
const createValidationError = createError({
  definition: z.object({
    code: z.string(),
    section: z.string(),
  }),
  data: {
    property: 'context',
    resolve: ({ definition, input }) => ({
      ...input,
      section: definition.section,
    }),
  },
  message: ({ data, implementation }) => implementation(data),
  properties: ({ definition, data }) => ({
    code: definition.code,
    section: definition.section,
    describe: () => `${definition.code} in ${definition.section}`,
  }),
});

class InvalidEmailError extends createValidationError({
  code: 'invalidEmail',
  section: 'profile',
})
  .defineContext(
    z.object({
      field: z.string(),
      section: z.literal('profile'),
    }),
  )
  .implement(({ field }) => `${field} is invalid`) {}

const error = new InvalidEmailError({ field: 'email' });
error.context; // { field: string; section: "profile" }
error.code; // "invalidEmail"
error.describe(); // "invalidEmail in profile"
```

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
  .implement((details) => `${details.resource} was not found`, {
    name: 'NotFoundError',
  });
```

## Naming error classes

A class declared with `class NotFoundError extends ... {}` uses its own name for
`error.name`, stack traces, and serialized output. A class assigned to a
variable has no name of its own, so pass `name` as the second argument to
`implement`. Without either, instances keep the native `"Error"` name.

```ts
const NotFoundError = createHttpError({ code: 'notFound', scope: 'request' })
  .implement((details: { resource: string }) => details.resource, {
    name: 'NotFoundError',
  });

new NotFoundError({ resource: 'user' }).name; // "NotFoundError"
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

Only plain objects passed to `implementation(argument)` receive the definition
fields. Class instances, such as a `Date` or `Map`, are passed through
unchanged. The types recognize common built-in classes, but they cannot tell
your own class instances from plain objects, so wrap those in an object, as in
`implementation({ user })`, when the implementation needs definition fields.

Every family exposes its shared base as `factory.Error`. Concrete classes and
named subclasses also inherit a lazy invariant helper:

```ts
InvalidFieldError.invariant(
  formIsValid,
  () => ({ field: 'email' }),
  { cause },
);
```

The input function runs only when the condition is falsy. TypeScript only
allows assertion methods on explicitly typed names, so the static method works
on `class` declarations. For a class stored in a `const`, use the standalone
`invariant` export, which narrows the same way:

```ts
import { invariant } from '@jfdevelops/create-error';

invariant(NotFoundError, user, () => ({ resource: 'user' }));
```

When an error's constructor input is itself a function, pass it wrapped, as in
`() => handler`, so it is not mistaken for lazy input. The types enforce this.

When `toJSON` is configured, it is installed once on the family prototype and
used by `JSON.stringify`. Its callback can read native error fields, configured
properties, and the resolved data property; each concrete error's `toJSON()`
return type preserves parsed definition output and context-schema output. When
omitted, the family does not add a `toJSON` method.

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
