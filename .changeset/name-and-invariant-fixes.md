---
'@jfdevelops/create-error': minor
---

Add a `name` option to `implement` for classes assigned to variables, which
previously reported the native `"Error"` name, and a standalone `invariant`
export that narrows with classes stored in a `const`.

Add `factory.is(value)`, a type guard for errors from any class in a family.
It and `instanceof factory.Error` now narrow to the fields every family error
shares, with definition-derived properties typed from the schema output.

Fix several type and runtime mismatches:

- Built-in class instances such as `Date` and `Map` passed to
  `implementation` no longer exceed TypeScript's instantiation depth or claim
  definition fields they do not receive.
- Function-valued constructor input keeps its call signature, and `invariant`
  requires such input to be wrapped so it is not mistaken for lazy input.
- Promise-like schema results are rejected as asynchronous instead of being
  treated as parsed values.
- `createError` and `implement` reject missing or non-function callbacks
  immediately.
- README and JSDoc examples that read `data` fields inside `properties` now
  compile.
