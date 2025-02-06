import {
  getComponentPublicMethods,
  getComponentPublicProperties,
} from "./cem-utils";
import type {
  Attribute,
  Component,
  CssCustomProperty,
  CssCustomState,
  CssPart,
  ComponentEvent,
  Method,
  Property,
  Slot,
  AttributeAndProperty,
} from "./types";

/** A generic type for creating customized docs for components APIs */
export type ComponentApiOptions<T = unknown> = {
  /** The section heading for the API */
  heading?: string;
  /** Additional section description for the API */
  description?: string;
  /** A template for rendering the API documentation */
  template?: (api?: T[]) => string;
};

/** Available options for setting the order of the docs APIs */
export type ApiOrderOption =
  | "attributes"
  | "properties"
  | "attrsAndProps"
  | "propsOnly"
  | "events"
  | "methods"
  | "slots"
  | "cssProps"
  | "cssParts"
  | "cssState";

/** Available options for configuring the way the components description is rendered */
export type ComponentDescriptionOptions = {
  /**
   * The order in which the documentation for each of the APIs will be rendered
   * If a key is not provided, it will not be rendered
   * @default ["attrsAndProps", "events", "methods", "slots", "cssProps", "cssParts", "cssState"]
   */
  order?: Array<ApiOrderOption>;
  /**
   * The source of the component description
   * @default "description"
   */
  descriptionSrc?: "description" | "summary" | (string & {});
  /**
   * The type of the component description
   * @default "parsedType"
   */
  altType?: string;
  /**
   * The options for each component API
   */
  apis?: {
    attributes?: ComponentApiOptions<Attribute>;
    properties?: ComponentApiOptions<Property>;
    attrsAndProps?: ComponentApiOptions<Attribute>;
    propsOnly?: ComponentApiOptions<Property>;
    events?: ComponentApiOptions<ComponentEvent>;
    methods?: ComponentApiOptions<Method>;
    slots?: ComponentApiOptions<Slot>;
    cssProps?: ComponentApiOptions<CssCustomProperty>;
    cssParts?: ComponentApiOptions<CssPart>;
    cssState?: ComponentApiOptions<CssCustomState>;
  };
};

export const defaultDescriptionOptions: ComponentDescriptionOptions = {
  order: [
    "attrsAndProps",
    "events",
    "methods",
    "slots",
    "cssProps",
    "cssParts",
    "cssState",
  ],
  descriptionSrc: "description",
  apis: {
    attributes: {
      heading: "Attributes",
      description: "HTML attributes that can be applied to this element.",
      template: (api?: Attribute[]) =>
        api
          ?.map((attr) => `- \`${attr.name}\`: ${attr.description}`)
          .join("\n") || "",
    },
    properties: {
      heading: "Properties",
      description: "Properties and methods provided by the component.",
      template: (api?: Property[]) =>
        api
          ?.map((prop) => `- \`${prop.name}\`: ${prop.description}`)
          .join("\n") || "",
    },
    attrsAndProps: {
      heading: "Attributes & Properties",
      description:
        "HTML attributes and properties that can be applied to this element.",
      template: (api?: AttributeAndProperty[]) =>
        api
          ?.map(
            (prop) =>
              `- \`${prop.attrName}\`/\`${prop.propName}\`: ${prop.description} ${
                !prop.attrName ? "(property only)" : ""
              }`
          )
          .join("\n") || "",
    },
    propsOnly: {
      heading: "Properties",
      description: "Properties that can be applied to this element.",
      template: (api?: Property[]) =>
        api
          ?.map((prop) => `- \`${prop.name}\`: ${prop.description}`)
          .join("\n") || "",
    },
    events: {
      heading: "Events",
      description: "Events emitted by the component.",
      template: (api?: ComponentEvent[]) =>
        api
          ?.map((event) => `- \`${event.name}\`: ${event.description}`)
          .join("\n") || "",
    },
    methods: {
      heading: "Methods",
      description: "Methods provided by the component.",
      template: (api?: Method[]) =>
        api
          ?.map((method) => `- \`${method.name}\`: ${method.description}`)
          .join("\n") || "",
    },
    slots: {
      heading: "Slots",
      description: "Slots provided by the component.",
      template: (api?: Slot[]) =>
        api
          ?.map((slot) => `- \`${slot.name}\`: ${slot.description}`)
          .join("\n") || "",
    },
    cssProps: {
      heading: "CSS Custom Properties",
      description: "CSS custom properties that can be applied to this element.",
      template: (api?: CssCustomProperty[]) =>
        api
          ?.map(
            (cssProp) =>
              `- \`${cssProp.name}\`: ${cssProp.description} (default: \`${cssProp.default}\`)`
          )
          .join("\n") || "",
    },
    cssParts: {
      heading: "CSS Parts",
      description: "CSS parts provided by the component.",
      template: (api?: CssPart[]) =>
        api
          ?.map((cssPart) => `- \`${cssPart.name}\`: ${cssPart.description}`)
          .join("\n") || "",
    },
    cssState: {
      heading: "CSS Custom States",
      description: "CSS custom states that can be applied to this element.",
      template: (api?: CssCustomState[]) =>
        api
          ?.map((cssState) => `- \`${cssState.name}\`: ${cssState.description}`)
          .join("\n") || "",
    },
  },
};

export function getApiByOrderOption(
  component: Component,
  api: ApiOrderOption
):
  | Attribute[]
  | Property[]
  | ComponentEvent[]
  | Method[]
  | Slot[]
  | CssCustomProperty[]
  | CssPart[]
  | CssCustomState[]
  | AttributeAndProperty[] {
  switch (api) {
    case "attributes":
      return component.attributes || ([] as Attribute[]);
    case "properties":
      return getComponentPublicProperties(component) || ([] as Property[]);
    case "attrsAndProps": {
      return getAttrsAndProps(component);
    }
    case "propsOnly": {
      return getPropsOnly(component);
    }
    case "events":
      return component.events || ([] as ComponentEvent[]);
    case "methods":
      return getComponentPublicMethods(component) as Method[];
    case "slots":
      return component.slots || ([] as Slot[]);
    case "cssProps":
      return component.cssProperties || ([] as CssCustomProperty[]);
    case "cssParts":
      return component.cssParts || ([] as CssPart[]);
    case "cssState":
      return component.cssStates || ([] as CssCustomState[]);
    default:
      return [];
  }
}

/**
 * Gets a combined list of public attributes and properties for a component.
 * @param {Component} component
 * @returns {AttributeAndProperty[]}
 */
export function getAttrsAndProps(component: Component): AttributeAndProperty[] {
  const attributes =
    component.attributes?.map((attr) => {
      return {
        attrName: attr.name,
        propName: attr.fieldName,
        summary: attr.summary,
        description: attr.description,
        inheritedFrom: attr.inheritedFrom,
        type: attr.type,
        default: attr.default,
        deprecated: attr.deprecated,
        static: false,
        source: undefined,
        readonly: false,
      };
    }) || [];
  const properties = getComponentPublicProperties(component)
    .filter((prop) => {
      return !attributes?.map((attr) => attr.propName).includes(prop.name);
    })
    .map((prop) => {
      return {
        attrName: undefined,
        propName: prop.name,
        summary: prop.summary,
        description: prop.description,
        inheritedFrom: prop.inheritedFrom,
        type: prop.type,
        default: prop.default,
        deprecated: prop.deprecated,
        static: prop.static,
        source: prop.source,
        readonly: prop.readonly,
      };
    });
  return [...attributes, ...properties];
}

export function getPropsOnly(component: Component): Property[] {
  const props = getComponentPublicProperties(component) || [];
  const attrs = component.attributes?.map((attr) => attr.name) || [];
  return props?.filter(
    (prop) => !attrs.includes(prop.name) || []
  ) as Property[];
}

/**
 * Gets the template for a component's description based on the options provided.
 * @param {Component} component CEM component/declaration object
 * @param {ComponentDescriptionOptions} options ComponentDescriptionOptions
 * @param {boolean} isComment prepares comment to be inserted into a multiline JS comment
 * @returns string
 */
export function getComponentDetailsTemplate(
  component: Component,
  options: ComponentDescriptionOptions,
  isComment = false
) {
  const apiOptions = {
    ...defaultDescriptionOptions,
    ...options,
  };

  let description = getComponentDescription(
    component,
    apiOptions.descriptionSrc
  );

  options.order?.forEach((key) => {
    const componentContent = getApiByOrderOption(component, key);
    const api = apiOptions.apis ? apiOptions.apis[key] : undefined;
    if (api) {
      // @ts-expect-error componentContent takes many shapes
      description += api.template ? api.template(componentContent) : "";
    }
  });

  if (isComment) {
    description = description
      .split("\n")
      .map((x) => ` * ${x}`)
      .join("\n");
  }

  return description;
}

/**
 * Gets the description from a CEM based on a specified source.
 * If no source is provided, it will default to the `summary` then to the `description` property.
 * @param component CEM component/declaration object
 * @param descriptionSrc property name of the description source
 * @returns string
 */
export function getComponentDescription(
  component: Component,
  descriptionSrc?: "description" | "summary" | (string & {})
): string {
  let description =
    (descriptionSrc
      ? (component[descriptionSrc] as string)
      : component.summary || component.description
    )?.replace(/\\n/g, "\n") || "";

  if (component.deprecated) {
    const deprecation =
      typeof component.deprecated === "string"
        ? `@deprecated ${component.deprecated}`
        : "@deprecated";
    description = `${deprecation}\n\n${description}`;
  }

  return description;
}

/**
 * Gets the description for a member based on the description and deprecated properties.
 * If the member is deprecated, it will prepend the description with the deprecation message and the `@deprecated` JSDoc tag.
 * @param description
 * @param deprecated
 * @returns
 */
export function getMemberDescription(
  description?: string,
  deprecated?: boolean | string
) {
  if (!deprecated) {
    return description || "";
  }

  const desc = description ? `- ${description}` : "";

  return typeof deprecated === "string"
    ? `@deprecated ${deprecated} ${desc}`
    : `@deprecated ${desc}`;
}
