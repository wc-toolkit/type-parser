import { Test2 } from "./alt-types";
import { Test } from "./types";

type Hobby = "sports" | "music" | "art";

/**
 * Test component
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
