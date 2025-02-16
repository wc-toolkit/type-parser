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

/**
 * Test component
 *
 * @tag my-component
 *
 * @prop {string} name - The name of the person to greet.
 * @prop {number} age - The age of the person to greet.
 * @prop {boolean} active - Whether the person is active.
 * @prop {Hobby} hobby - The hobbies of the person to greet.
 * @prop {Test} test - The test2 of the person to greet.
 * @prop {Test2} test2 - The test of the person to greet.
 */
export class MyComponent extends HTMLElement {
  name: string;
  age: number;
  active: boolean;
  hobby: Hobby;
  test: Test;
  test2: Test2;
  test3: Test | Test2;

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
