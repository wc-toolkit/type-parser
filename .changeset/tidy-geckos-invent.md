---
"@wc-toolkit/type-parser": patch
---

Improve type parsing fallbacks for complex and recursive aliases.

The parser now preserves manifest generation by warning and falling back to the original type text when a type cannot be safely expanded, and it resolves more object-based utility types such as `Omit`.
