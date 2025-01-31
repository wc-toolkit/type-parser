import * as cem from "custom-elements-manifest";

export type Component<T = Record<string, unknown>> = cem.CustomElement & T;
export type Attribute<T = Record<string, unknown>> = cem.Attribute & T;
export type Property<T = Record<string, unknown>> = cem.ClassField & T;
export type CssCustomProperty<T = Record<string, unknown>> =
  cem.CssCustomProperty & T;
export type CssCustomState<T = Record<string, unknown>> = cem.CssCustomState &
  T;
export type CssPart<T = Record<string, unknown>> = cem.CssPart & T;
export type ComponentEvent<T = Record<string, unknown>> = cem.Event & T;
export type Method<T = Record<string, unknown>> = cem.ClassMethod & {
  type: cem.Type;
} & T;
export type Slot<T = Record<string, unknown>> = cem.Slot & T;
