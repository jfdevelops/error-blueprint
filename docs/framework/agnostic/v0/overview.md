---
title: Overview
description: Build related native error classes with shared validation and behavior.
order: 10
---

`@jfdevelops/create-error` builds strongly typed error families from a shared
blueprint. Configure the definition schema, constructor-data lifecycle, message,
and optional properties once; concrete classes supply their own context schema
and message implementation.

## Choose a blueprint

Use a family when errors share a contract such as a stable code, common metadata,
or a JSON representation. Each generated class extends native `Error`, preserving
stack traces, subclass checks, and `cause`.

| Concept | Purpose |
| --- | --- |
| Blueprint | Configure behavior shared by a family. |
| Definition | Validate metadata captured when a concrete class is defined. |
| Context | Validate and optionally transform data supplied for one error instance. |
| Implementation | Produce the concrete error's message using the argument chosen by the blueprint. |

## Follow the lifecycle

1. Call `createError(blueprint)` to configure a family.
2. Call the returned factory with a definition to capture validated metadata.
3. Optionally select a context schema with `defineContext(schema)`.
4. Call `implement(callback)` to create an extendable class.
5. Construct an instance with its context and optional native error options.

Definitions and context use synchronous Standard Schema V1 validators. The
package does not bundle a validator; the guides use Zod as an example.

## Next steps

- [Install the package](installation.md).
- [Create your first error family](quick-start.md).
- [Customize shared behavior](guides/customize-errors.md).
