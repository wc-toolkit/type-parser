<div align="center">
  
![workbench with tools, html, css, javascript, and jsdoc logos](https://raw.githubusercontent.com/wc-toolkit/jsdoc-tags/refs/heads/main/assets/wc-toolkit_jsdoc.png)

</div>

# WC Toolkit Type Parser

This is a plugin maps custom JSDoc tags on your component classes to properties in Custom Elements Manifest using the [Custom Element Manifest Analyzer](https://custom-elements-manifest.open-wc.org/).

## Installation 

```bash
npm i -D @wc-toolkit/jsdoc-tags
```

## Usage

Add the information you would like to include with you component in the class's JSDoc comment using custom tags. In this example, the `@dependency`, `@since`, `@status`, and `@spec` tags are all custom.

```js
// my-component.js

/**
 *
 * My custom element does some amazing things
 *
 * @tag my-element
 *
 * @dependency icon
 * @dependency button
 *
 * @since 1.2.5
 * 
 * @status beta - not ready for production
 * 
 * @spec https://www.figma.com/...
 *
 */
export class MyElement extends HTMLElement {
  ...
}
```

In the [CEM analyzer config](https://custom-elements-manifest.open-wc.org/analyzer/config/), import the plugin and add the mappings for the new tags.

```js
// custom-elements-manifest.config.mjs

import { jsDocTagsPlugin } from "@wc-toolkit/jsdoc-tags";

export default {
  ...
  /** Provide custom plugins */
  plugins: [
    jsDocTagsPlugin({
      tags: {
        // finds the values for the `@since` tag
        since: {},
        // finds the values for the `@status` tag
        status: {},
        // finds the values for the `@spec` tag
        spec: {},
        // finds the values for the `@dependency` tag
        dependency: {
          // maps the values to the `dependencies` property in the CEM
          mappedName: 'dependencies',
          // ensures the values are always in an array (even if there is only 1)
          isArray: true,
        },
      }
    }),
  ],
};
```

## Result

The data should now be included in the Custom Elements Manifest.

```json
// custom-elements.json

{
  "kind": "class",
  "description": "My custom element does some amazing things",
  "name": "MyElement",
  "tagName": "my-element",
  "since": {
    "name": "1.2.5",
    "description": ""
  },
  "status": {
    "name": "beta",
    "description": "not ready for production"
  },
  "spec": {
    "name": "https://www.figma.com/...",
    "description": ""
  },
  "dependencies": [
    {
      "name": "icon",
      "description": ""
    },
    {
      "name": "button",
      "description": ""
    }
  ]
}
```

<div style="text-align: center; margin-top: 32px;">
  <a href="https://stackblitz.com/edit/stackblitz-starters-endx3har?file=README.md">
    <img
      alt="Open in StackBlitz"
      src="https://developer.stackblitz.com/img/open_in_stackblitz.svg"
    />
  </a>
</div>

Be sure to check out the [official docs](https://wc-toolkit.com/documentation/jsdoc-tags) for more information on how to use this.