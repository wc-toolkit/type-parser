/**
 * This CEM is unique because it has multiple Declarations
 */
export const guiCem = {
  schemaVersion: "1.0.0",
  readme: "",
  modules: [
    {
      kind: "javascript-module",
      path: "components/icon/internal/icon.js",
      declarations: [
        {
          kind: "class",
          description: "",
          name: "Icon",
          members: [
            {
              kind: "field",
              name: "label",
              type: {
                text: "string",
              },
              default: "''",
              description:
                "An description of the icon to use for accessibility. If omitted, the icon will be ignored by assistive devices.",
              attribute: "label",
            },
            {
              kind: "field",
              name: "#_effects",
              privacy: "private",
              default:
                "new EffectGroupController( this, effect( () => { this[internals].ariaLabel = this.label; this[internals].ariaHidden = this.label ? 'false' : 'true'; }, () => [this.label], ), )",
            },
            {
              kind: "field",
              name: "role",
              type: {
                text: "string",
              },
              default: "'img'",
            },
          ],
          attributes: [
            {
              name: "label",
              type: {
                text: "string",
              },
              default: "''",
              description:
                "An description of the icon to use for accessibility. If omitted, the icon will be ignored by assistive devices.",
              fieldName: "label",
            },
          ],
          superclass: {
            name: "BaseClass",
            module: "components/icon/internal/icon.js",
          },
        },
      ],
      exports: [
        {
          kind: "js",
          name: "Icon",
          declaration: {
            name: "Icon",
            module: "components/icon/internal/icon.js",
          },
        },
      ],
    },
    {
      kind: "javascript-module",
      path: "components/icon/gui-icon.js",
      declarations: [
        {
          kind: "class",
          description: "",
          name: "GuiIcon",
          cssProperties: [
            {
              name: "--gui-icon-size",
              default: "min(1lh, 1.2em)",
            },
            {
              name: "--gui-icon-color",
              default: "currentColor",
            },
          ],
          members: [
            {
              kind: "field",
              name: "label",
              type: {
                text: "string",
              },
              default: "''",
              description:
                "An description of the icon to use for accessibility. If omitted, the icon will be ignored by assistive devices.",
              attribute: "label",
              inheritedFrom: {
                name: "Icon",
                module: "components/icon/internal/icon.js",
              },
            },
            {
              kind: "field",
              name: "#_effects",
              privacy: "private",
              default:
                "new EffectGroupController( this, effect( () => { this[internals].ariaLabel = this.label; this[internals].ariaHidden = this.label ? 'false' : 'true'; }, () => [this.label], ), )",
              inheritedFrom: {
                name: "Icon",
                module: "components/icon/internal/icon.js",
              },
            },
            {
              kind: "field",
              name: "role",
              type: {
                text: "string",
              },
              default: "'img'",
              inheritedFrom: {
                name: "Icon",
                module: "components/icon/internal/icon.js",
              },
            },
          ],
          superclass: {
            name: "Icon",
            module: "/components/icon/internal/icon",
          },
          tagName: "gui-icon",
          customElement: true,
          attributes: [
            {
              name: "label",
              type: {
                text: "string",
              },
              default: "''",
              description:
                "An description of the icon to use for accessibility. If omitted, the icon will be ignored by assistive devices.",
              fieldName: "label",
              inheritedFrom: {
                name: "Icon",
                module: "components/icon/internal/icon.js",
              },
            },
          ],
        },
      ],
      exports: [
        {
          kind: "js",
          name: "GuiIcon",
          declaration: {
            name: "GuiIcon",
            module: "components/icon/gui-icon.js",
          },
        },
        {
          kind: "custom-element-definition",
          name: "gui-icon",
          declaration: {
            name: "GuiIcon",
            module: "components/icon/gui-icon.js",
          },
        },
      ],
    },
  ],
};
