/* eslint-disable @typescript-eslint/no-explicit-any */
export interface SizeProps {
  size: "small" | "medium" | "large";
}

type Constructor<T = object> = new (...args: any[]) => T;

export const WithSize = <T extends Constructor<HTMLElement>>(superClass: T) => {
  class WithSizeElement extends superClass {
    size: SizeProps["size"];
  }
  return WithSizeElement;
};
