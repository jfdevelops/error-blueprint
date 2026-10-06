# @jfdevelops/create-error

## 0.1.1

### Patch Changes

- 74d1b3c: Include the configured data property in generated instance types and derive
  definition-backed fields from parsed schema output so transforms remain sound.

## 0.1.0

### Minor Changes

- 3d1ced2: Add the Standard Schema-backed error-family factory with inferred definitions,
  optional context-schema builders, resolved constructor data, generated
  properties, unary implementation callbacks, serialization, and shared family
  error classes.
- f772c4a: Include concrete error-definition fields in object arguments passed to
  implementation callbacks while preserving directly forwarded data values.
- 53bde9a: Export a straightforward `CreateErrorConfig<Schema>` interface and consolidate
  the exact inference machinery shared by the `createError` overloads.

### Patch Changes

- 21222b9: Add focused JSDoc examples for configuring data, properties, serialization,
  context validation, implementations, invariants, and family factories.
- dfe0791: Simplify the internal inference machinery by consolidating its type markers and
  removing an unnecessary constructor-input marker.
- 1376404: Clarify implementation-builder inference with reusable conditional and function
  expansion helpers.
- 4cf2543: Add comprehensive editor documentation and practical examples for the public
  error factory API, including the distinct roles of `data` and `properties`.
- 367c69a: Share one implementation-builder interface across direct and context-schema
  builder paths while preserving inferred data and schema input/output types.
- 991e509: Preserve configured error properties, definition literals, and context-schema
  output in `toJSON` callback and return types.
