# Contributing

## Local setup

Use Node.js `>=22.12.0` for development, including `@jfdevelops/docs`, and the
package manager version declared in `package.json` (`pnpm@10.28.1`). The library's
runtime engine requirement remains Node.js `>=20.19.0`.

```sh
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` runs source type checking, Vitest, the ESM/CommonJS build, and
consumer/declaration compilation against the built package. Run it before
submitting changes to public behavior or types.

## Repository layout

- `src/create-error.ts`: runtime factory, validation, and invariant helpers.
- `src/types.ts`: public contracts and inference machinery.
- `src/index.ts`: package exports.
- `test/create-error.test.ts`: runtime behavior.
- `test/inference.test.ts`: TypeScript inference contracts.
- `test/fixtures/`: built-package consumer and declaration checks.
- `docs/`: usage guides and API reference.

Useful focused commands are `pnpm typecheck`, `pnpm test`, `pnpm test:watch`,
`pnpm build`, and `pnpm test:package`. Build before running package fixture
checks. `pnpm dev` rebuilds the library in watch mode.

## Managed project setup

This existing library was adopted with `@jfdevelops/cli init`. `jfdevelops.json`
records its target, enabled agents, skills, and managed files. `AGENTS.md` links
the applicable conventions; read them before making changes.

```sh
pnpm exec jfdevelops skills
pnpm exec jfdevelops init
pnpm exec jfdevelops update
```

`skills` reports package/skill alignment, `init` reviews adoption changes, and
`update` reviews upgrades to managed setup. The CLI and convention package are
development dependencies and are not part of the library's runtime API.

## Documentation

Keep the [README](README.md) and [documentation](docs/README.md) aligned with
runtime behavior and exported types. Examples should distinguish constructor
input from resolved data and schema output. Check type-sensitive examples
against the package rather than relying on runtime output alone.

Public pages live in `docs/framework/agnostic/v0/`, matching the package major.
The docs addon in `jfdevelops.json` selects this package and its public entry point.

### Generate the API reference

After installing development dependencies, run:

```sh
pnpm docs:generate
pnpm docs:check
```

Open `docs/framework/agnostic/v0/reference/index.md` locally to browse the generated
API reference. The reference is generated during CI validation but is not
published by the docs workflow or committed to the repository.

Generation creates the TypeDoc API reference, the schema-v2 `docs/docs.json`, and
navigation `meta.json` files. These outputs are ignored by Git; commit authored
Markdown and configuration. The docs workflow runs generation and validation
when pages, source, or their configuration change.

## Releases

For a package change that should be released, add a changeset:

```sh
pnpm changeset
```

Maintainers consume pending changesets with `pnpm version-packages`, review the
version and changelog, then publish with `pnpm release`. Follow the repository's
release workflow and publish only when authorized.
