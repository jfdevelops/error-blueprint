# Documentation

Public docs for `@jfdevelops/create-error` live in `framework/agnostic/v0/`.

- [Overview](framework/agnostic/v0/overview.md)
- [Installation](framework/agnostic/v0/installation.md)
- [Quick start](framework/agnostic/v0/quick-start.md)
- [Customize errors](framework/agnostic/v0/guides/customize-errors.md)
- [Recipes](framework/agnostic/v0/guides/recipes.md)

Run `pnpm docs:generate` to build the API reference and navigation, then
`pnpm docs:check` to validate pages and links. The generated `docs.json`,
`meta.json`, and `reference/` pages are ignored by Git.

Follow the installed `jf-docs` skill before editing public pages. Use `title`,
`description`, and `order` frontmatter; keep each directory ordered in steps of 10.
See the repository's `CONTRIBUTING.md` for local checks and releases.
