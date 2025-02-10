import { describe, expect, test } from "vitest";
import {
  removeQuotes,
  toKebabCase,
  toPascalCase,
} from "./string-utils.js";

describe("toKebabCase", () => {
  test("given a string in Pascal case, it should convert it kebab case", () => {
    // Arrange
    const input = "TestExample";

    // Act
    const result = toKebabCase(input);

    // Assert
    expect(result).toBe("test-example");
  });

  test("given a string in camel case, it should convert it kebab case", () => {
    // Arrange
    const input = "testExample";

    // Act
    const result = toKebabCase(input);

    // Assert
    expect(result).toBe("test-example");
  });
});

describe("removeQuoteWrappers", () => {
  test("given a string with an apostrophe wrapper, it should remove the apostrophes", () => {
    // Arrange
    const input = `'Test'`;

    // Act
    const result = removeQuotes(input);

    // Assert
    expect(result).toBe("Test");
  });

  test("given a string with an quote wrapper, it should remove the quotes", () => {
    // Arrange
    const input = `"Test"`;

    // Act
    const result = removeQuotes(input);

    // Assert
    expect(result).toBe("Test");
  });

  test("given a string with a quote wrapper and an apostrophe within it, it should remove the wrapper but leave the apostrophe", () => {
    // Arrange
    const input = `"Can't"`;

    // Act
    const result = removeQuotes(input);

    // Assert
    expect(result).toBe("Can't");
  });
});

describe("toPascalCase", () => {
  test("given a string in kebab case, it should convert it to pascal case", () => {
    // Arrange
    const input = "test-example";

    // Act
    const result = toPascalCase(input);

    // Assert
    expect(result).toBe("TestExample");
  });

  test("given a string in snake case, it should convert it to pascal case", () => {
    // Arrange
    const input = "test_example";

    // Act
    const result = toPascalCase(input);

    // Assert
    expect(result).toBe("TestExample");
  });

  test("given a string in with spaces, it should convert it pascal case", () => {
    // Arrange
    const input = "test example";

    // Act
    const result = toPascalCase(input);

    // Assert
    expect(result).toBe("TestExample");
  });
});
