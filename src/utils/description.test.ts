import { describe, expect, test } from "vitest";
import { getMemberDescription } from "./description";

describe("getMemberDescription", () => {
  test("should return a string without `@deprecated` tag", () => {
    // Arrange
    const input = "Test description";

    // Act
    const result = getMemberDescription(input);

    // Assert
    expect(result).toBe("Test description");
  });

  test("should return a string with `@deprecated` tag when `deprecated is `true`", () => {
    // Arrange
    const input = "Test description";

    // Act
    const result = getMemberDescription(input, true);

    // Assert
    expect(result).toBe("@deprecated - Test description");
  });

  test("should return the deprecation string and tag when `deprecated is string", () => {
    // Arrange
    const input = "Test description";

    // Act
    const result = getMemberDescription(input, 'Deprecation message');

    // Assert
    expect(result).toBe("@deprecated Deprecation message - Test description");
  });
});
