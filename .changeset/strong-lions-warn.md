---
"@wc-toolkit/type-parser": patch
---

Fix imported type alias resolution when a type name is declared in multiple files. Parsed types are now resolved through the TypeScript AST and type checker (using the type's actual declaration symbol) instead of matching by type name and resolved filename string, so members correctly resolve to the type actually imported by the module. Types imported from `node_modules` are also resolved correctly (previously they fell through the import-path fallbacks and were not expanded).

Also respect tsconfig `exclude` glob patterns (e.g. `**/dist`) when walking source files, instead of substring-matching absolute paths.

Memoize top-level type expansion results in a `WeakMap` keyed by the type object, so per-member resolution reuses the walk's computed types instead of re-expanding them.

Add `maxParseDepth` (default 8) and `maxParseProperties` (default 50) options so the expansion bail limits can be raised for types with deep or large structures. Boolean-typed object properties now expand to `boolean` instead of `false | true`.
