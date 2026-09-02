---
"@wc-toolkit/type-parser": patch
---

Resolve `parsedType` for members declared on a Lit-style mixin.

Declaration matching only recognised a manifest declaration when its name matched the class node exactly. A mixin factory's inner class (for example `WithFooClass`) never matched its emitted `kind: mixin` declaration (`WithFoo`), so the mixin's members kept their raw type text instead of an expanded union. Declaration matching now recognises `mixin` declarations by their factory name, and the existing node-based resolution runs on them.
