---
title: Installation
description: Install the error factory and a Standard Schema validator.
order: 20
---

Install `@jfdevelops/create-error` and a synchronous Standard Schema V1 validator.
The examples use Zod, which is installed separately.

## Install the packages

```npm
npm i @jfdevelops/create-error zod
```

```pnpm
pnpm add @jfdevelops/create-error zod
```

```yarn
yarn add @jfdevelops/create-error zod
```

```bun
bun add @jfdevelops/create-error zod
```

If you already use a compatible validator such as Valibot or ArkType, keep it
and install only the error package.

## Import the public API

The package supports ESM and CommonJS. Its Node.js engine requirement is
`>=20.19.0`.

```ts
import { createError, invariant } from '@jfdevelops/create-error';
```

```js
const { createError, invariant } = require('@jfdevelops/create-error');
```

`createError` and `invariant` are the runtime exports. Configuration, builder,
and error-class contracts are also available as type-only exports.

## Next steps

- [Create a validated error family](quick-start.md).
- [Browse the generated API reference](reference/index.md).
