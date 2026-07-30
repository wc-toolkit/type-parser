import path from "path";
import ts from "typescript";
import { afterEach, describe, expect, test, vi } from "vitest";
import cem from "../../demo/custom-elements.json" with { type: "json" };
import {
  getComponentByClassName,
  getComponentPublicProperties,
} from "@wc-toolkit/cem-utilities";
import { Property } from "@wc-toolkit/cem-utilities";
import { getTsProgram, typeParserPlugin } from "../cem-plugin.js";

describe("type-parser", () => {
  type Prop = Property<
    Record<string, unknown> & { parsedType?: { text: string } }
  >;
  const component = getComponentByClassName(cem, "MyComponent");
  const properties = getComponentPublicProperties<Prop>(component!);
  const fixturePath = path.resolve("src/__fixtures__/recursive-types.ts");

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("should not create parsed types for JS primitive types", () => {
    // Arrange
    const name = properties.find((p) => p.name === "name");
    const age = properties.find((p) => p.name === "age");
    const active = properties.find((p) => p.name === "active");

    // Act

    // Assert
    expect(name?.parsedType?.text).toBeUndefined();
    expect(age?.parsedType?.text).toBeUndefined();
    expect(active?.parsedType?.text).toBeUndefined();
  });

  test("should resolve types in same file", () => {
    // Arrange
    const internal = properties.find((p) => p.name === "internal");

    // Act

    // Assert
    expect(internal?.parsedType?.text).toEqual("'sports' | 'music' | 'art'");
  });

  test("should resolve types from external .ts file", () => {
    // Arrange
    const tsExternal = properties.find((p) => p.name === "tsExternal");

    // Act

    // Assert
    expect(tsExternal?.parsedType?.text).toEqual(
      "'value4' | 'value5' | 'value6'",
    );
  });

  test("should resolve types from external .d.ts file", () => {
    // Arrange
    const dtsExternal = properties.find((p) => p.name === "dtsExternal");

    // Act

    // Assert
    expect(dtsExternal?.parsedType?.text).toEqual(
      "'value1' | 'value2' | 'value3'",
    );
  });

  test("should resolve types for generic type", () => {
    // Arrange
    const generic = properties.find((p) => p.name === "generic");

    // Act

    // Assert
    expect(generic?.parsedType?.text).toEqual(
      "'value1' | 'value2' | 'value3' | 'sports' | 'music' | 'art'",
    );
  });

  test("should resolve types for Exclude utility type", () => {
    // Arrange
    const exclude = properties.find((p) => p.name === "exclude");

    // Act

    // Assert
    expect(exclude?.parsedType?.text).toEqual(
      "'value4' | 'value5' | 'value6' | 'value2' | 'value3'",
    );
  });

  test("should resolve types for named union type", () => {
    // Arrange
    const namedUnion = properties.find((p) => p.name === "namedUnion");

    // Act

    // Assert
    expect(namedUnion?.parsedType?.text).toEqual(
      "'value4' | 'value5' | 'value6' | 'value1' | 'value2' | 'value3'",
    );
  });

  test("should resolve types for enum keys", () => {
    // Arrange
    const direction = properties.find((p) => p.name === "direction");

    // Act

    // Assert
    expect(direction?.parsedType?.text).toEqual(
      "'Up' | 'Down' | 'Left' | 'Right'",
    );
  });

  test("should resolve types for enum", () => {
    // Arrange
    const enumExample = properties.find((p) => p.name === "enumExample");

    // Act

    // Assert
    expect(enumExample?.parsedType?.text).toEqual("0 | 1 | 2 | 3");
  });

  test("should normalize absolute module paths to relative manifest paths", () => {
    const plugin = typeParserPlugin({});
    const moduleDoc = {
      path: path.resolve("demo/src/my-component.ts"),
      declarations: [],
    };

    plugin?.analyzePhase?.({
      ts: { SyntaxKind: { SourceFile: 0, ClassDeclaration: 1 } },
      node: { kind: -1 },
      moduleDoc,
      context: {},
    });

    expect(moduleDoc.path).toEqual("demo/src/my-component.ts");
  });

  test("should warn and fall back when a type cannot be safely expanded", () => {
    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    typeParserPlugin({ parseObjectTypes: "full" });

    expect(() =>
      getTsProgram(ts, [fixturePath], "tsconfig.json"),
    ).not.toThrow();

    const warningOutput = warnSpy.mock.calls
      .map((args) => args.join(" "))
      .join("\n");
    expect(warningOutput).toContain("RecursiveLocal");
    expect(warningOutput).toContain("src/__fixtures__/recursive-types.ts");
    expect(warningOutput).toContain("recursive type reference");
    expect(warningOutput).toContain("Node");
    expect(warningOutput).toMatch(
      /node_modules\/typescript\/lib|node_modules\\\\typescript\\\\lib/,
    );
  });

  test("should resolve compilerOptions inherited via tsconfig `extends`", () => {
    const extendingConfigDir = path.resolve(
      "src/__fixtures__/tsconfig-extends",
    );
    const sampleFile = path.join(extendingConfigDir, "sample.ts");
    const originalCwd = process.cwd();
    process.chdir(extendingConfigDir);

    try {
      const program = getTsProgram(ts, [sampleFile], "tsconfig.json");

      expect(program.getCompilerOptions().target).toEqual(
        ts.ScriptTarget.ES2018,
      );
    } finally {
      process.chdir(originalCwd);
    }
  });

  test("should include files matched by tsconfig `include` and exclude files matched by `exclude`, even when not passed as globs", () => {
    const configDir = path.resolve("src/__fixtures__/tsconfig-include-exclude");
    const originalCwd = process.cwd();
    process.chdir(configDir);

    try {
      const program = getTsProgram(ts, [], "tsconfig.json");
      const sourceFileNames = program
        .getSourceFiles()
        .map((sourceFile) => sourceFile.fileName);

      expect(sourceFileNames.some((name) => name.endsWith("included.ts"))).toBe(
        true,
      );
      expect(sourceFileNames.some((name) => name.endsWith("excluded.ts"))).toBe(
        false,
      );
    } finally {
      process.chdir(originalCwd);
    }
  });
});
