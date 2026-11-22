---
name: jf-docs
description: Write, edit, move, or review user-facing library documentation in jfdevelops projects, including guides, installation and quick-start pages, migration guides, versioned docs, docs for a new major, frontmatter, and links. Read before any docs change, even when the request only says to document a feature or update a guide.
---

# Documentation

These defaults cover user-facing library docs written as Markdown pages for a docs
site. They do not cover READMEs, code comments, changelogs, or maintainer notes,
except where those link into the docs.

## Read the current project first

Before editing, read the project's own docs rules. Look for a docs README, a
content contract or style guide (often under `docs/maintainers/`), the docs check
and generate scripts in `package.json`, and two or three existing pages near the
one you are changing. A project's rules take precedence over these defaults, and
current user instructions take precedence over both. Use these defaults only where
the project is silent.

Identify these before writing:

- where pages for each framework and version live
- which files are generated (navigation, manifests, the API reference), because
  generated files are never edited by hand
- the allowed frontmatter keys and Markdown features
- the commands that generate and check the docs

## Layout

The default layout is versioned by framework and major:

```text
docs/
  README.md                  repository index, not published
  framework/<framework>/
    v<major>/
      overview.md            top-level pages: overview, installation,
      installation.md        quick-start, typescript, devtools
      guides/*.md            how-to guides, troubleshooting, migration
      plugins/*.md           companion packages
      reference/             current major: generated API reference, never committed
                             earlier majors: hand-written reference/api.md
      assets/*               images only
  maintainers/               contributor notes, never public
```

- Write a change in the version directory whose release it describes. A feature
  added in 4.x goes in `v4/`. Change an earlier major only to fix something that
  was wrong at that release.
- Keep pages out of the docs root. When a page moves, update every link to it
  rather than leaving a stub.
- Generate navigation from the pages. Do not keep hand-written ordering files in
  sync with frontmatter.
- Never edit the current major's generated reference. Earlier majors keep a
  hand-written `reference/api.md` that the generator never touches; correct it
  directly, checked against that major's last release tag.
- Link to the reference instead of copying signatures into a guide:
  `reference/index.md` or a page under it in the current major, and
  `reference/api.md` in earlier majors.
- Never link a public page to maintainer notes.

### When a new major ships

The generator writes a reference only for the current major, and that reference is
never committed. Without these steps the outgoing major is left with none. Do them
in one change, before or with the version bump:

1. Write `reference/api.md` for the outgoing major by hand. Take the exports from the
   package entry points at that major's last release tag, and name the version and
   tag in the intro. Don't copy the generated output: it spans many pages and is
   marked as generated, so the docs check rejects it outside the current major.
   Delete the generated pages from that `reference/` folder, so only `api.md` is left.
2. In the outgoing major's pages, change links from `reference/index.md` and its
   subpages to `reference/api.md`, with anchors that exist there.
3. Add the `v<major>/` directory for the new major. If the project ignores the
   generated reference by path, move that ignore entry to the new major.
4. Run the project's docs generate and check commands.

## Frontmatter

```yaml
---
title: Lazy loading
description: Code-split whole pages and single states, with typed errors and retry.
order: 60
---
```

- Use only the keys the project allows. By default these are `title`,
  `description` and `order`.
- `order` sets the sidebar position. Use steps of 10 so pages can be inserted
  later, and keep it unique within a directory. Check sibling pages before choosing.
- The title is plain text and does not name the page's own version. Migration pages
  are the exception, for example "Migrating from v3 to v4".
- The description is one sentence saying what the reader can do with the page.

## Writing

Write plainly, so a reader can follow the page on a first read. Do not model the
docs on another project's docs or describe them as a copy of one.

- **No `#` heading.** The site renders the frontmatter title as the `h1`. Sections
  start at `##`, and heading levels never skip.
- **Open with one or two sentences** that say what the feature does and when to use
  it. A guide then lists "In this guide you will:" with three to five verb-first
  bullets.
- **One idea per section,** with a task-style heading such as "Load a page lazily"
  or "Choose a package". Show the code, then explain what matters about it.
- **Prefer a table** to a paragraph that lists options, packages or terms.
- **Use callouts sparingly.** A block quote opening with `**Note:**`, `**Tip:**` or
  `**Warning:**` is a callout. Use one only for a rule that is easy to miss, such
  as a precedence order or a required call order.
- **End with "Next steps",** a short list of links to the pages a reader most
  likely needs next.
- **Don't name the page's own version** in the title, description or intro. The URL
  and version selector already show it. Name another version only for a real
  cross-version fact: a migration step, an "added in 4.1.0" note, or a
  compatibility table.

## Accuracy

- Document only what the source supports at that version. Check exports, tests
  and the changelog before describing an API.
- For an earlier major, read the source at that major's last release tag, for
  example `git show <package>@<version>:<path>`, not the default branch.
- Never invent dates, versions or release facts. Take them from the changelog, the
  package manifest or git tags.

## Code

- Give every fence a language the project allows, such as `ts`, `tsx`, `json` or
  `bash`.
- Write examples the way a reader would. Import from the public package name, not
  internal paths, and use realistic domain names.
- Write each install command once per package manager, in consecutive fences
  labeled `npm`, `pnpm`, `yarn` and `bun`, so a docs site can show them as tabs.
  Use `npm i`, `pnpm add`, `yarn add` and `bun add`, and give a development
  dependency `-D` in all four. Keep install commands out of `sh` and `bash` fences.

  ````markdown
  ```npm
  npm i @acme/widgets
  ```

  ```pnpm
  pnpm add @acme/widgets
  ```

  ```yarn
  yarn add @acme/widgets
  ```

  ```bun
  bun add @acme/widgets
  ```
  ````

- Pin versions the same way in all four fences.
  - **Current major:** install unpinned, or pin a release of that major.
  - **Earlier majors:** pin every package to an exact version, with the main
    package at that major's last release, so copying an old guide never installs
    the latest major.
- If the project type-checks examples from fixture files, keep the page's code and
  its fixture identical.

## Links

- Link between pages with relative `.md` paths, with an optional `#anchor`. Anchors
  follow the GitHub heading slug rules.
- Cross-version links are relative too, for example `../../v3/migration.md`.
- External links use `https://`. Point to repository source with inline code or an
  `https://` link pinned to a tag, not a link into the default branch.
- Never use absolute `/` paths.
- When a page moves, update package READMEs and other repository files that link
  to it.

## Verify and deliver

- Run the project's docs generate and check commands, plus its format and lint
  commands. All must pass. Fix the page rather than weakening the checker.
- If formatting touches a file you did not edit and the only change is line
  endings, restore that file.
- Follow `jf-git` for branches, commits and pull requests. A docs-only change
  usually uses the `docs` type and needs no release entry unless the project says
  otherwise.
