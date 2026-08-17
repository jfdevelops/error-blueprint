# Plan 003: Build the standalone configurable error-blueprint library

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. This plan creates a new standalone repository;
> do not add another workspace package to `multi-step-form`. When done, update
> the status row for this plan in `multi-step-form/plans/README.md` unless a
> reviewer told you they maintain the index.
>
> **Drift check (run first from `multi-step-form`)**:
> `git diff --stat 9778039..HEAD -- packages/core/src/errors/multi-step-form-error.ts packages/core/test/errors.test.ts packages/core/package.json packages/core/tsdown.config.ts packages/core/tsconfig.json packages/core/vite.config.ts package.json`
> If any reference file changed, compare the excerpts below against the live
> code. If its public error behavior or build tooling changed, stop and report
> the drift before creating the standalone repository.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `9778039`, 2026-08-17

## Why this matters

`createMultiStepFormError` currently combines reusable class-construction
mechanics with multi-step-form-specific concepts such as `code`, `scope`,
`context`, rendering, and serialization. The new library should extract the
reusable mechanism into a standalone package while allowing each consumer to
declare an error-family blueprint through configuration. Its primary quality
bar is TypeScript inference: concrete definition values must remain literal,
constructor input must derive from implementation data, and ordinary call
sites must never need `as const` or explicit generic arguments.

## Product and API decisions

Treat these as requirements, not suggestions:

- Create a standalone single-package repository named `create-error`, with the
  recommended npm name `@jfdevelops/create-error` and initial version `0.1.0`.
- Use pnpm, TypeScript, Vite/Vitest, and tsdown backed by Rolldown, matching the
  technologies used by `multi-step-form`.
- Do not create a monorepo, `pnpm-workspace.yaml`, example application,
  framework binding, or changesets setup.
- Export one runtime value from the root entry point: `createError`.
- `createError(config)` creates both a callable error-family factory and the
  shared base error class for that family. A base class is output, never input.
- Expose the generated base as `createdFactory.Error`, allowing a consumer to
  publish it under a domain name such as `MultiStepFormError`.
- The generated family is called as `factory(definition)(implementation)` and
  returns an extendable concrete error class.
- The blueprint is declarative. Do not require the consumer to write a callback
  that manually builds and returns the complete factory.
- Configuration owns definition fields, data resolution, message creation,
  additional properties/methods, and optional JSON serialization.
- Definition values supplied to generated factories retain their literal types
  through internal `const` type parameters. No `as const` is permitted in the
  public-API fixtures except where an unrelated tuple/array value itself needs
  readonly semantics.
- The implementation must work with object, scalar, tuple, union, class-instance,
  `null`, and `undefined` data. Do not constrain data to `Record<string, unknown>`.
- The generated base must preserve normal `Error` semantics: `instanceof Error`,
  subclass `name`, `message`, optional `cause`, stack, and prototype behavior.

The acceptance fixture is this multi-step-form-shaped blueprint. Minor naming
changes inside the configuration are allowed only if they make the API simpler
without weakening any inference assertion below:

```ts
const createMultiStepFormError = createError({
  definition: {
    code: String,
    scope: String,
  },

  data: {
    property: 'context',
    resolve({ definition, input }) {
      return {
        ...input,
        scope: definition.scope,
      };
    },
  },

  message({ definition, data, implementation }) {
    return implementation(definition.scope, data);
  },

  properties({ definition, data, implementation }) {
    return {
      code: definition.code,
      scope: definition.scope,
      context: data,

      renderMessage(renderer = implementation) {
        return renderer(definition.scope, data);
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

export const MultiStepFormError = createMultiStepFormError.Error;

class InvalidFieldError extends createMultiStepFormError({
  code: 'invalidField',
  scope: 'field',
})(
  (_scope, context: { scope: 'field'; field: string }) =>
    `${context.field} is invalid`,
) {}
```

The descriptor rules must be small and documented:

- `String`, `Number`, and `Boolean` describe broad primitive definition fields
  while preserving the concrete literal supplied later.
- A directly supplied array of literals describes an allowed literal union;
  `createError` must capture it with a `const` generic so the blueprint itself
  does not require `as const`.
- Do not add a general validation/schema system. These descriptors exist for
  static factory typing, not runtime input validation.

## Current state

The implementation belongs in a new repository. The following files in
`multi-step-form` are read-only references and must not be modified by this
plan:

- `packages/core/src/errors/multi-step-form-error.ts` — behavior and inference
  reference for the new abstraction.
- `packages/core/test/errors.test.ts` — runtime and `expectTypeOf` acceptance
  reference.
- `packages/core/tsdown.config.ts` — tsdown/Rolldown build reference.
- `packages/core/tsconfig.json` and `packages/core/vite.config.ts` — TypeScript
  and Vite/Vitest references.
- Root `package.json` — pnpm and tool-version reference.

At `packages/core/src/errors/multi-step-form-error.ts`, the current factory uses
a `const` generic to preserve `code` and `scope`:

```ts
export function createMultiStepFormError<
  const options extends CreateMultiStepFormErrorOptions,
>(
  options: options,
): MultiStepFormErrorRendererFactory<options['code'], options['scope']>;
```

The current base supplies the behavior that the generated family base must be
able to reproduce through configuration:

```ts
export abstract class MultiStepFormError<...> extends Error {
  static invariant<condition, errorContext extends Record<string, unknown>>(
    this: new (context: errorContext) => Error,
    condition: condition,
    context: errorContext | (() => errorContext),
  ): asserts condition;

  abstract renderMessage(...): string;
  toJSON() { ... }
}
```

Repository conventions to carry into the standalone library:

- Prefer named `function` declarations over arrow-assigned functions.
- Use meaningful camelCase names and inferred return types.
- Keep the package unbundled, emit CJS and ESM, emit declarations and source
  maps, and use fixed extensions.
- Match the existing Conventional Commit form `type(scope): subject`; examples
  include `fix(form): stabilize validation and selector components`.
- Do not create or switch branches unless the operator explicitly requests it.
- Do not commit, push, publish, or open a pull request without explicit operator
  permission.

## Commands you will need

Run these in the new standalone repository after it exists:

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install | `pnpm install` | exit 0 and `pnpm-lock.yaml` created |
| Typecheck | `pnpm typecheck` | exit 0 with no diagnostics |
| Unit/type tests | `pnpm test` | exit 0; all Vitest tests pass once |
| Build | `pnpm build` | exit 0; CJS, ESM, declarations, and maps in `dist/` |
| Package smoke test | `pnpm pack --pack-destination ./artifacts` | exit 0; one `.tgz` produced |
| Full gate | `pnpm check` | typecheck, test, and build all exit 0 |

## Scope

**In scope** for the new standalone repository:

- `package.json`
- `pnpm-lock.yaml`
- `tsconfig.json`
- `tsdown.config.ts`
- `vite.config.ts`
- `.gitignore`
- `.npmrc`
- `LICENSE`
- `README.md`
- `.github/workflows/ci.yml`
- `src/index.ts`
- `src/create-error.ts`
- `src/types.ts` only if private type machinery would make
  `src/create-error.ts` unreadable
- `test/create-error.test.ts`
- `test/inference.test.ts`
- `test/fixtures/consumer.ts`

**Out of scope**:

- Any modification to `multi-step-form`; integration/migration belongs in a
  separate follow-up plan after the standalone package is proven and published.
- A monorepo, workspace configuration, Changesets, release automation, a docs
  website, framework adapters, or an example app.
- Runtime validation of definitions or data.
- Logging, telemetry, localization, HTTP-specific fields, or multi-step-form
  terminology in the generic implementation.
- Additional root runtime exports beyond `createError`.

## Git workflow

- Initialize one Git repository at the standalone `create-error` root only if
  the operator requested repository initialization.
- Do not create a branch unless the operator explicitly requests one. If
  authorized, the branch must use one allowed prefix: `feat/`, `fix/`, `docs/`,
  `test/`, `chore/`, `ci/`, `refactor/`, or `hotfix/`.
- Do not commit without permission. If permission is later given, use a single
  subject-only message such as `feat(core): add configurable error blueprints`.
- Do not push, publish the package, or create a PR without separate permission.

## Steps

### Step 1: Prove the public type surface before implementing runtime behavior

Create only the minimal `package.json`, `tsconfig.json`, `src/index.ts`,
`src/create-error.ts`, and `test/inference.test.ts` needed to compile the
acceptance fixture. Start with type declarations and a throwing placeholder
implementation. The test must establish the final public syntax before runtime
logic makes that syntax expensive to change.

Use `const` type parameters in both `createError(config)` and the generated
`factory(definition)` stage. Supporting type aliases may remain internal in the
emitted declaration; do not export them from `src/index.ts`.

Add compile-time assertions for all of the following:

- `{ code: 'invalidField', scope: 'field' }` infers the exact literals without
  `as const`.
- The implementation callback's scope is inferred as `'field'`.
- An annotated context `{ scope: 'field'; field: string }` makes the generated
  constructor accept exactly `{ field: string }` after `data.resolve` injects
  `scope`.
- Instances expose literal `code` and `scope`, the full resolved context, and
  the configured `renderMessage` signature.
- `factory.Error` is construct/type-compatible as the shared base of all errors
  made by that factory.
- A blueprint definition descriptor using
  `code: ['notFound', 'unauthorized']` accepts only those values without
  `as const` on the descriptor array.
- Scalar, tuple, union, class-instance, `null`, and `undefined` data can flow
  through a blueprint without becoming `unknown`, `any`, or a record.
- Invalid definition values, missing constructor fields, extra constructor
  fields on object literals, and incompatible renderer contexts use
  `@ts-expect-error` and are confirmed to fail compilation.
- The emitted public API has no required explicit generic arguments and no
  public `any` types. Internal conditional/inference helpers may use `unknown`.

**Verify**: `pnpm typecheck` → exit 0 with every positive assertion passing and
every `@ts-expect-error` consumed.

### Step 2: Scaffold the standalone package and build pipeline

Complete the single-package repository metadata:

- Set `name` to `@jfdevelops/create-error`, `version` to `0.1.0`, `type` to
  `module`, license to MIT, public provenance publishing, and repository fields
  for the final standalone GitHub URL.
- Use the same baseline tool family as `multi-step-form`: pnpm `10.28.1`,
  TypeScript `^5.9.2`, Vite `^7.1.11`, Vitest `^3.2.4` or the one compatible
  version selected by the lockfile, and tsdown `^0.17.2` backed by Rolldown.
- Add scripts: `build`, `dev` (`tsdown --watch`), `test` (`vitest run`),
  `test:watch` (`vitest`), `typecheck` (`tsc --noEmit`), and `check` chaining
  typecheck, test, and build.
- Configure tsdown with a single `src/index.ts` entry, `unbundle: true`, source
  maps, no minification, CJS and ESM, declarations, fixed extensions, and clean
  builds.
- Configure strict TypeScript with ES2020-or-newer target, ESNext modules,
  bundler module resolution, isolated modules, declaration output, unused-code
  checks, and Vitest globals.
- Configure Vite only for Vitest/package testing; do not create an application
  dev server.
- Export CJS, ESM, types, and `./package.json`; include only `dist`, README,
  LICENSE, and package metadata in the published tarball.
- Keep `src/index.ts` to one runtime export:
  `export { createError } from './create-error.js';`.

**Verify**: `pnpm install && pnpm build` → exit 0 and `dist/` contains working
CJS, ESM, source maps, and declaration files.

### Step 3: Implement definition descriptors and blueprint normalization

Implement internal type and runtime normalization for the declarative config:

- `definition` is required and must be a non-empty object.
- Support `String`, `Number`, and `Boolean` descriptors.
- Support non-empty literal arrays as restricted unions. Capture directly
  supplied arrays with a `const` type parameter; callers must not write
  `as const`.
- Reject unsupported descriptors with a clear `TypeError` at blueprint creation
  rather than silently widening them.
- Keep descriptors out of created error instances unless the consumer returns
  them from `properties`.
- Do not validate each later definition value at runtime beyond inexpensive
  membership/type checks implied by the declared descriptors.

Add runtime tests for valid primitives, allowed literal lists, empty-list
rejection, unsupported descriptor rejection, and disallowed definition values.

**Verify**: `pnpm test -- definition` → exit 0; all descriptor tests pass.

### Step 4: Generate the family base and three-stage factory

Implement `createError(config)` so it creates one internal base class per
blueprint and returns a callable factory with that base attached as `.Error`.
The base must:

- Extend the native `Error` class.
- Set `name` from `new.target.name` so named subclasses report their own names.
- Preserve `message`, optional `cause`, stack, and the prototype chain.
- Store the configured resolved data under `data.property`.
- Supply a static lazy `invariant(condition, inputOrFactory)` method. The input
  factory must run only when the condition is falsy and the thrown instance must
  be the concrete generated/subclassed error.
- Use the optional configured `toJSON`; omit custom serialization entirely when
  it was not configured.

The returned factory must:

- Capture a concrete definition in stage one.
- Capture the consumer implementation in stage two.
- Return a concrete, extendable class whose constructor accepts the inferred
  unresolved input.
- Run `data.resolve`, then `message`, then `properties` in a documented order.
- Assign configured properties without overwriting protected native fields or
  internal mechanics. Reject collisions for `name`, `message`, `stack`,
  `cause`, `constructor`, and `prototype` with a clear error.
- Allow methods returned by `properties` to use their closure and remain
  correctly typed.

**Verify**: `pnpm test -- factory` → exit 0; tests confirm native `Error`, family
base, concrete generated class, and user subclass `instanceof` relationships.

### Step 5: Complete behavioral and edge-case coverage

Model `test/create-error.test.ts` after
`multi-step-form/packages/core/test/errors.test.ts`. Cover:

- Object-context construction with injected definition data.
- Default and custom message rendering.
- Literal `code` and `scope` at runtime.
- `factory.Error` as the common base across two concrete error definitions.
- A named subclass receiving the subclass name.
- Optional cause preservation.
- Lazy invariant input evaluated zero times on success and once on failure.
- Custom `toJSON` and `JSON.stringify` behavior.
- No `toJSON` own/custom method when the blueprint omits it.
- Scalar, tuple, union, class-instance, `null`, and `undefined` data.
- Property collision failures.
- Thrown exceptions from consumer callbacks retaining their original identity;
  do not wrap blueprint or renderer failures.

Add `test/fixtures/consumer.ts` as a declaration-consumer fixture importing only
from the package root. It must recreate the acceptance blueprint and prove it
works against built package exports rather than source-relative imports.

**Verify**: `pnpm check` → typecheck, all tests, and build exit 0.

### Step 6: Document the stable contract and package contents

Write `README.md` with:

- The error-family concept and the distinction between blueprint, definition,
  implementation, and concrete error.
- The full multi-step-form-shaped example from this plan.
- A restricted-code/scope example showing direct arrays without `as const`.
- A non-object data example.
- `factory.Error`, subclassing, `invariant`, `cause`, and `toJSON` behavior.
- The exact callback execution order and property-collision rules.
- A TypeScript inference section explicitly stating that call sites require no
  explicit generics or `as const`.
- A customization section explaining that the library creates the base class;
  consumers customize behavior through configuration rather than supplying a
  `BaseError`.

Add a minimal CI workflow that checks out the repository, configures pnpm and
the Node version declared by the package, installs with a frozen lockfile, and
runs `pnpm check`. Add MIT `LICENSE`, `.gitignore` for dependencies/build/test
artifacts, and `.npmrc` settings needed for consistent pnpm behavior.

**Verify**: `pnpm check` → exit 0, then
`pnpm pack --pack-destination ./artifacts` → the tarball contains only the
intended build output and documentation and does not contain `src/`, `test/`,
or local artifacts.

### Step 7: Perform a clean consumer smoke test

Create a temporary directory outside both repositories, install the generated
tarball with pnpm, and compile/run one ESM consumer and one CJS consumer. Each
must import only `createError` from the package root, recreate a small blueprint,
throw a concrete subclass, and verify its message, custom literal property,
`instanceof Error`, and `instanceof factory.Error` behavior.

Delete the temporary consumer after recording the results. Do not publish the
package during this step.

**Verify**: both consumer programs exit 0; `npm`/pnpm package inspection shows
one root runtime export named `createError` and no undeclared runtime dependency.

## Test plan

- `test/inference.test.ts` is the contract-first suite. It must contain positive
  `expectTypeOf` assertions and negative `@ts-expect-error` cases for every
  inference requirement in Step 1.
- `test/create-error.test.ts` is the runtime suite. Structure its assertions
  after `multi-step-form/packages/core/test/errors.test.ts` but keep the new
  library domain-neutral.
- `test/fixtures/consumer.ts` tests built public declarations/exports and must
  never import from `../src`.
- The test suite must prove both broad descriptors (`String`) and restricted
  literal arrays, always without `as const` at blueprint and generated-factory
  call sites.
- Verification: `pnpm check` must pass from a clean install.

## Done criteria

- [ ] The implementation is a standalone single-package repository with no
      workspace or monorepo configuration.
- [ ] The package root has exactly one runtime export, `createError`.
- [ ] `createError(config)` returns a callable
      `definition → implementation → class` factory with a generated `.Error`.
- [ ] The acceptance blueprint compiles and runs without `as const` or explicit
      generic arguments at its call sites.
- [ ] Literal definition values, constructor input, resolved data, configured
      properties, methods, and serialization are inferred as specified.
- [ ] Object and non-object data shapes pass compile-time and runtime tests.
- [ ] Native Error semantics, subclassing, lazy invariants, cause, and prototype
      behavior pass runtime tests.
- [ ] `pnpm typecheck`, `pnpm test`, and `pnpm build` each exit 0.
- [ ] `pnpm pack --pack-destination ./artifacts` produces a minimal valid tarball.
- [ ] Clean ESM and CJS consumer smoke tests against the tarball exit 0.
- [ ] No `multi-step-form` source or configuration file is modified.
- [ ] `multi-step-form/plans/README.md` marks Plan 003 DONE only after all gates pass.

## STOP conditions

Stop and report back instead of improvising if:

- The exact acceptance syntax cannot preserve literal `code`/`scope`, infer
  constructor input from the implementation data, or avoid public `any` without
  adding `as const`, explicit generic arguments, or a callback-builder API.
- TypeScript requires weakening the declarative configuration into the rejected
  `createError(({ createClass }) => ...)` design.
- Supporting arbitrary data shapes would require constraining data to an object
  or record.
- The generated family base cannot be exposed as `.Error` while retaining a
  callable factory and correct static typing.
- Runtime property assignment would allow configuration to corrupt native Error
  fields without a breaking restriction not described here.
- The desired npm package name or standalone repository URL differs from
  `@jfdevelops/create-error` / `create-error`; resolve naming before generating
  package metadata or a lockfile.
- Any implementation step appears to require modifying `multi-step-form`.
- A verification command fails twice after one reasonable correction.

## Maintenance notes

- Treat the inference suite as the compatibility contract. Review declaration
  diffs whenever TypeScript, tsdown, or Rolldown is upgraded.
- Reviewers should scrutinize use of conditional types for accidental widening,
  distributive behavior over unions, compile-time performance, and leaked `any`.
- Keep descriptor support deliberately small. If richer runtime validation is
  wanted later, integrate with an external schema library in a separate major
  design rather than growing a partial schema system here.
- Do not migrate `createMultiStepFormError` until a published/tarball consumer
  test proves the standalone package. That migration should be a separate plan
  with compatibility tests and its own changeset in `multi-step-form`.
