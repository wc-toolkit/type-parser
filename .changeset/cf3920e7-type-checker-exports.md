---
"@wc-toolkit/type-parser": minor
---

Export `getTypeChecker()` and `getProgram()` accessor functions for use in custom CEM plugins (fixes #10).

Replace `typeChecker.getProgram()` call (removed from TypeScript 5.x) with stored program reference to fix #14.

Add `debug` field to default options and ensure logger is always initialized in `getTsProgram` to fix #15.
