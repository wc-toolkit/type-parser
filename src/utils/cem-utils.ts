import type * as cem from "custom-elements-manifest";
import { ComponentEvent, Method } from "./types";

export const EXCLUDED_TYPES = [
  "any",
  "bigint",
  "boolean",
  "never",
  "null",
  "number",
  "string",
  "Symbol",
  "undefined",
  "unknown",
];

/**
 * Gets a list of all components from a Custom Elements Manifest object
 * @param customElementsManifest
 * @param exclude an array of component names to exclude
 * @returns CustomElement[]
 */
export function getAllComponents(
  customElementsManifest: unknown,
  exclude: string[] = []
) {
  return (
    (customElementsManifest as cem.Package).modules
      ?.map((mod) =>
        mod.declarations
          ?.filter((d) => (d as cem.CustomElement).customElement)
          ?.flat()
      )
      ?.flat() || []
  ).filter((x) => x && !exclude?.includes(x.name)) as cem.CustomElement[];
}

/**
 * Gets a component from a CEM object based on the class name
 * @param customElementsManifest CEM object
 * @param exclude and array of component names to exclude
 * @returns Component
 */
export function getComponentByClassName(
  customElementsManifest: unknown,
  className?: string
) {
  return getAllComponents(customElementsManifest).find(
    (c) => c.name === className
  );
}

/**
 * Gets a component from a CEM object based on the tag name
 * @param customElementsManifest CEM object
 * @param exclude and array of component names to exclude
 * @returns Component
 */
export function getComponentByTagName(
  customElementsManifest: unknown,
  tagName?: string
) {
  return getAllComponents(customElementsManifest).find(
    (c) => c.tagName === tagName
  );
}

/**
 * Gets a list of public properties from a CEM component
 * @param component CEM component/declaration object
 * @returns an array of public properties for a given component
 */
export function getComponentPublicProperties(component: cem.CustomElement) {
  return (component?.members?.filter(
    (member) =>
      member.kind === "field" &&
      member.privacy !== "private" &&
      member.privacy !== "protected" &&
      !member.static &&
      !member.name.startsWith("#")
  ) || []) as cem.ClassMember[];
}

/**
 * Get all public methods for a component
 * @param component CEM component/declaration object
 * @returns ClassMethod[]
 */
export function getComponentPublicMethods(
  component: cem.CustomElement
): Method[] {
  const getParameter = (p: cem.Parameter) =>
    p.name + getParamType(p) + getParamDefaultValue(p);
  const getParamType = (p: cem.Parameter) =>
    p.type?.text ? `${p.optional ? "?" : ""}: ${p.type?.text}` : "";
  const getParamDefaultValue = (p: cem.Parameter) =>
    p.default ? ` = ${p.default}` : "";

  return (
    // filter to return only public methods
    component?.members?.filter(
      (member) =>
        member.kind === "method" &&
        member.privacy !== "private" &&
        member.privacy !== "protected" &&
        !member.name.startsWith("#")
    ) as Method[]
  )?.map((m) => {
    // reconstruct method type
    m.type = {
      text: `${m.name}(${m.parameters?.map((p) => getParameter(p)).join(", ") || ""}) => ${m.return?.type?.text || "void"}`,
    };

    return m;
  });
}

/** The type used to define the configuration options for the `getComponentEventsWithType` function */
export type EventOptions = {
  /** The name of the property where custom detail type is stored */
  customEventDetailTypePropName?: string;
  /** Overrides the event type from `CustomEvent` to the type specified in the event type in the CEM */
  overrideCustomEventType?: boolean;
};

/**
 * Get all events for a component with the complete event type
 * @param component CEM component/declaration object
 * @param options {EventOptions} options for custom event detail type and custom event type
 * @returns Event[]
 */
export function getComponentEventsWithType(
  component: cem.CustomElement,
  options: EventOptions = {}
): ComponentEvent[] | void[] {
  const events = component?.events?.map((e) => {
    const type: string =
      (e as unknown as Record<string, cem.Type>)[
        `${options.customEventDetailTypePropName}`
      ]?.text || e.type?.text;

    const eventType = options.overrideCustomEventType
      ? type || "CustomEvent"
      : type
        ? `CustomEvent<${type}>`
        : "CustomEvent";

    return {
      ...e,
      type: {
        text: eventType,
      },
    };
  });

  return events || [];
}

/**
 * Gets a list of event names for a given component.
 * This is used for generating a list of event names for an import in a type definition file.
 * If the event detail type is not a named type, custom type, or a generic, it will not be included in the list.
 * @param component The component you want to get the event types for
 * @param excludedTypes Any types you want to exclude from the list
 * @returns A string array of event types for a given component
 */
export function getCustomEventDetailTypes(
  component: cem.CustomElement,
  excludedTypes?: string[]
): (string | undefined)[] {
  const types =
    component?.events
      ?.map((e) => {
        const eventType = e.type?.text
          .replace("[]", "")
          .replace(" | undefined", "");
        return eventType &&
          !excludedTypes?.includes(eventType) &&
          !EXCLUDED_TYPES.includes(eventType) &&
          !eventType.includes("<") &&
          !eventType.includes(`{`) &&
          !eventType.includes("'") &&
          !eventType.includes(`"`)
          ? eventType
          : undefined;
      })
      ?.filter((e) => e !== undefined && !e?.startsWith("HTML")) || [];

  return types?.length ? [...new Set(types)] : [];
}
