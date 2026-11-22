---
title: Customize errors
description: Configure shared metadata, constructor data, messages, and public properties.
order: 10
---

A blueprint defines the contract shared by related error classes. Use it to
normalize constructor input, expose definition metadata, and choose how concrete
implementations receive their data.

In this guide you will:

- Separate definitions from instance context.
- Configure the constructor lifecycle.
- Choose an implementation argument.
- Catch a family and protect native error properties.

## Capture definition metadata

The `definition` schema validates class-level metadata when you call the factory.
It must produce an object. Definition-derived properties use the parsed schema
output type, so transformations affect both runtime values and public types.
Use literal or enum schemas when values should be restricted.

## Resolve constructor data

`data.property` names the instance property holding resolved context.
`data.resolve({ definition, input })` receives the captured definition and the
constructor input. It can forward that input or combine it with metadata.

For every instance, callbacks run in this order:

1. `data.resolve`
2. Context validation and transformation, if configured
3. `message`
4. `properties`, if configured

`defineContext(schema)` selects one synchronous context schema. Its input type
describes constructor input, with inferred definition-injected fields omitted;
its output type describes stored context. Without a schema, annotate the
implementation's data parameter when inference needs help. That annotation adds
static types without runtime validation.

The blueprint's `data` is an opaque type template because concrete classes can
have different contexts. Forward it or pass it to `implementation`; read specific
context fields in the concrete implementation.

## Choose the implementation argument

The argument to `implementation(argument)` in the blueprint's message callback
determines the concrete implementation's single parameter.

```ts
import { createError } from '@jfdevelops/create-error';
import { z } from 'zod';

const createRequestError = createError({
  definition: z.object({ code: z.string() }),
  data: {
    property: 'context',
    resolve: ({ input }) => input,
  },
  message: ({ data, implementation }) => implementation({ context: data }),
  properties: ({ definition }) => ({ code: definition.code }),
});

class MissingUserError extends createRequestError({ code: 'missingUser' })
  .defineContext(z.object({ userId: z.string() }))
  .implement(({ code, context }) => `${code}: user ${context.userId} was not found`) {}

const error = new MissingUserError({ userId: 'user_123' });
error.code; // string
error.context.userId; // string
```

Plain object arguments receive parsed definition fields automatically. Argument
fields win on collisions. Scalars, arrays, functions, and class instances pass
through unchanged at runtime. Types recognize common built-in instances such as
`Date` and `Map`, but cannot reliably distinguish custom instances from plain
objects; wrap custom instances in an object when you need definition fields.

## Expose properties and serialization

`properties` returns additional own fields, methods, getters, or symbols for
each instance. It preserves their property descriptors and does not transform
constructor input. Use `data.resolve` and the context schema for transformations.

An optional `toJSON(error)` callback defines the family's JSON representation.
It is installed on the shared prototype and runs when `toJSON()` or
`JSON.stringify(error)` is called. Without it, the library adds no serializer.

## Catch a family

`factory.Error` is the common base class. `factory.is(value)` checks
`value instanceof factory.Error`, narrowing to shared properties; context is
`unknown` because concrete errors can have different context types. Use a
concrete class check to recover its specific context type.

Separate factories create independent families. Errors from another factory or
realm, and objects parsed from JSON, do not acquire family identity. Use
`InstanceType<typeof factory.Error>` to name the shared instance type.

## Preserve native properties

The data property and additional properties cannot replace `name`, `message`,
`stack`, `cause`, `constructor`, or `prototype`. Repeating the data property is
allowed only as a value descriptor holding the exact resolved value.

Validation issues become a `TypeError`, and asynchronous validation results are
rejected. Exceptions thrown directly by a validator or callback propagate unchanged.
The library creates the family base; there is no custom `BaseError` option.

## Next steps

- [Normalize data and preserve causes](recipes.md).
- [Inspect configuration and builder types](../reference/index.md).
