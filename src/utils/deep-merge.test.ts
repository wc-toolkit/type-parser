import { describe, expect, expectTypeOf, test } from "vitest";
import { isObject, deepMerge } from "./deep-merge.js";

describe("isObject", () => {
  test("should be `true` when value is `{ value: 'some value'}`", () => {
    expect(isObject({ value: "some value" })).toBe(true);
  });
  test("should be `false` when value is a number", () => {
    expect(isObject(5)).toBe(false);
  });
  test("should be `false` when value is an array", () => {
    expect(isObject([1, 2, 3, 4, 5])).toBe(false);
  });
  test("should be `false` when value is a string", () => {
    expect(isObject("some value")).toBe(false);
  });
  test("should be `false` when value is a boolean", () => {
    expect(isObject(true)).toBe(false);
  });
  test("should be `false` when value is a function", () => {
    expect(isObject(() => "some value")).toBe(false);
  });
});

describe("mergeDeep", () => {
  test("should merge two objects", () => {
    const target = {
      a: 1,
      b: 2,
      c: {
        d: 3,
        e: 4,
      },
    };
    const source = {
      a: 2,
      c: {
        d: 4,
      },
    };
    const expected = {
      a: 2,
      b: 2,
      c: {
        d: 4,
        e: 4,
      },
    };
    expect(deepMerge(target, source)).toEqual(expected);
  });

  test("should merge two objects with nested objects", () => {
    const target = {
      a: 1,
      b: 2,
      c: {
        d: 3,
        e: 4,
      },
    };
    const source = {
      a: 2,
      c: {
        d: 4,
        f: {
          g: 5,
        },
      },
    };
    const expected = {
      a: 2,
      b: 2,
      c: {
        d: 4,
        e: 4,
        f: {
          g: 5,
        },
      },
    };

    expect(deepMerge(target, source)).toEqual(expected);
  });

  test("should merge two objects with nested arrays", () => {
    const target = {
      a: 1,
      b: 2,
      c: {
        d: 3,
        e: 4,
      },
    };
    const source = {
      a: 2,
      c: {
        d: 4,
        f: [1, 2, 3, 4, 5],
      },
    };
    const expected = {
      a: 2,
      b: 2,
      c: {
        d: 4,
        e: 4,
        f: [1, 2, 3, 4, 5],
      },
    };
    expect(deepMerge(target, source)).toEqual(expected);
  });
  test("should use the generic to strongly type the result", () => {
    type Target = {
      a?: number,
      b?: number,
      c?: {
        d?: number,
        e?: number,
        f?: number[],
      },
    };

    const target = {
      a: 1,
      b: 2,
      c: {
        d: 3,
        e: 4,
      },
    };
    const source = {
      a: 2,
      c: {
        d: 4,
        f: [1, 2, 3, 4, 5],
      },
    };

    const result = deepMerge<Target>(target, source);

    expectTypeOf(result).toEqualTypeOf<Target>();
  });
});
