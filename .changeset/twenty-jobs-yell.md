---
"@wc-toolkit/type-parser": patch
---

Fix getTsProgram to resolve extends chains in tsconfig.json instead of silently falling back to default compiler options. Root files are now also resolved from the tsconfig's include/exclude, unioned with the caller-supplied globs.
