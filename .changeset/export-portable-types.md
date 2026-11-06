---
'@jfdevelops/create-error': patch
---

Export every type that appears in public `createError` signatures from the
package root so consumers with `declaration: true` can emit portable `.d.ts`
files without TS2883, TS4023, or TS2742.
