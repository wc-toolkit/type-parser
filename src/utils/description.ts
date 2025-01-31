import {
  getComponentPublicMethods,
  getComponentPublicProperties,
} from "./cem-utils";
import {
  Attribute,
  Component,
  CssCustomProperty,
  CssCustomState,
  CssPart,
  ComponentEvent,
  Method,
  Property,
  Slot,
} from "./types";

export type ComponentApiOptions<T = unknown> = {
  label?: string;
  description?: string;
  template?: (api?: T[]) => string;
};

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

export type ComponentDescriptionOptions = {
  order?: Array<ApiOrderOption>;
  descriptionSrc?: "description" | "summary" | (string & {});
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
    "attributes",
    "properties",
    "attrsAndProps",
    "propsOnly",
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
      label: "Attributes",
      description: "HTML attributes that can be applied to this element.",
      template: (api?: Attribute[]) =>
        api
          ?.map((attr) => `- \`${attr.name}\`: ${attr.description}`)
          .join("\n") || "",
    },
    properties: {
      label: "Properties",
      description: "Properties and methods provided by the component.",
      template: (api?: Property[]) =>
        api
          ?.map((prop) => `- \`${prop.name}\`: ${prop.description}`)
          .join("\n") || "",
    },
    attrsAndProps: {
      label: "Attributes & Properties",
      description:
        "HTML attributes and properties that can be applied to this element.",
      template: (api?: Attribute[]) =>
        api
          ?.map(
            (attr) =>
              `- \`${attr.name}\`/\`${attr.fieldName}\`: ${attr.description} ${
                attr.attribute ? "(attribute)" : "(property)"
              }`
          )
          .join("\n") || "",
    },
    propsOnly: {
      label: "Properties",
      description: "Properties that can be applied to this element.",
      template: (api?: Property[]) =>
        api
          ?.map((prop) => `- \`${prop.name}\`: ${prop.description}`)
          .join("\n") || "",
    },
    events: {
      label: "Events",
      description: "Events emitted by the component.",
      template: (api?: ComponentEvent[]) =>
        api
          ?.map((event) => `- \`${event.name}\`: ${event.description}`)
          .join("\n") || "",
    },
    methods: {
      label: "Methods",
      description: "Methods provided by the component.",
      template: (api?: Method[]) =>
        api
          ?.map((method) => `- \`${method.name}\`: ${method.description}`)
          .join("\n") || "",
    },
    slots: {
      label: "Slots",
      description: "Slots provided by the component.",
      template: (api?: Slot[]) =>
        api
          ?.map((slot) => `- \`${slot.name}\`: ${slot.description}`)
          .join("\n") || "",
    },
    cssProps: {
      label: "CSS Custom Properties",
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
      label: "CSS Parts",
      description: "CSS parts provided by the component.",
      template: (api?: CssPart[]) =>
        api
          ?.map((cssPart) => `- \`${cssPart.name}\`: ${cssPart.description}`)
          .join("\n") || "",
    },
    cssState: {
      label: "CSS Custom States",
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
  | CssCustomState[] {
  switch (api) {
    case "attributes":
      return (component.attributes as Attribute[]) || [];
    case "properties":
      return (getComponentPublicProperties(component) as Property[]) || [];
    case "attrsAndProps":
      return (component.attributes as Attribute[]) || [];
    case "propsOnly": {
      const props = getComponentPublicProperties(component) || [];
      const attrs = component.attributes?.map((attr) => attr.name) || [];
      return (
        (props?.filter((prop) => !attrs.includes(prop.name)) as Property[]) ||
        []
      );
    }
    case "events":
      return (component.events as ComponentEvent[]) || [];
    case "methods":
      return (getComponentPublicMethods(component) as Method[]) || [];
    case "slots":
      return (component.slots as Slot[]) || [];
    case "cssProps":
      return (component.cssProperties as CssCustomProperty[]) || [];
    case "cssParts":
      return (component.cssParts as CssPart[]) || [];
    case "cssState":
      return (component.cssCustomStates as CssCustomState[]) || [];
    default:
      return [];
  }
}

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
