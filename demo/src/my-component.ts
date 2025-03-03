/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Test2 } from "./alt-types";
import type { Test } from "./types";

type Hobby = "sports" | "music" | "art";
type MyPartialType = Partial<{ prop1: string; prop2: number }>;
type MyReadonlyType = Readonly<{ prop1: string; prop2: number }>;
type MyRecordType = Record<string, number>;
type MyPickType = Pick<{ prop1: string; prop2: number }, "prop1">;
type MyOmitType = Omit<{ prop1: string; prop2: number }, "prop2">;
type MyRequiredType = Required<{ prop1?: string; prop2?: number }>;
type UnionType = Test | Test2;
type ExcludeUnionType = Exclude<Test | Test2, "value1">;
type GenericType<T> = T | Test;
type MyGeneric = GenericType<Hobby>;
enum DirectionEnum {
  Up,
  Down,
  Left,
  Right,
}
type DirectionOptions = keyof typeof DirectionEnum;

type Alignment = 'start' | 'end';
type Side = 'top' | 'right' | 'bottom' | 'left';
type AlignedPlacement = `${Side}-${Alignment}`;

export type PopoverPosition = Side | AlignedPlacement;

export interface PositionPopoverOptions {
  arrowElement?: string | HTMLElement;
  anchorElement?: string | HTMLAnchorElement;
  arrowPadding?: number;
  maxWidth?: number;
  offset?: number;
  position?: PopoverPosition;
  viewportMargin?: number;
  rootMarginTop?: number;
}

export type AnchorControllerConfig = PositionPopoverOptions;

export interface ButtonProps {
  variant: 'primary' | 'secondary' | 'tertiary'
  size: 'sm' | 'md' | 'lg'
}

type Variant = ButtonProps['variant'];

/**
 * Test component
 *
 * @tag my-component
 *
 */
export class MyComponent extends HTMLElement {
  name: string;
  age: number;
  active: boolean;
  internal: Hobby;
  dtsExternal: Test;
  tsExternal: Test2;
  test3: Test | Test2;
  generic: MyGeneric;
  exclude: ExcludeUnionType;
  namedUnion: UnionType;
  direction: DirectionOptions;
  enumExample: DirectionEnum;
  variant: Variant = "primary";
  foobar: { [key: string]: any } = { foo: 'bar' }
  complexObject: PositionPopoverOptions;
  omitType: MyOmitType;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.render();
  }

  render() {
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = `
      <style>
        h1 {
          color: blue;
        }
      </style>
      `;
    }
  }
}

customElements.define("my-component", MyComponent);
