import path from "path";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getTsProgram, typeParserPlugin } from "../cem-plugin.js";

const fixtureDir = path.resolve("src/__fixtures__/type-aliases");
const globExcludeDir = path.resolve("src/__fixtures__/tsconfig-glob-exclude");
const originalCwd = process.cwd();

interface TestMember {
  name: string;
  type?: { text: string };
  optional?: boolean;
  parameters?: {
    name: string;
    type?: { text: string };
    parsedType?: { text: string };
  }[];
}

interface ParsedMember extends TestMember {
  parsedType?: { text: string };
}

interface ModuleDoc {
  path: string;
  declarations: { kind: string; name: string; members: ParsedMember[] }[];
}

interface PluginOptions {
  parseObjectTypes?: "none" | "partial" | "full";
  parseParameters?: boolean;
  propertyName?: string;
  debug?: boolean;
  skip?: boolean;
}

function analyzeClass(
  className: string,
  members: TestMember[],
  files: string[],
  options: PluginOptions = {},
): ModuleDoc {
  const plugin = typeParserPlugin(options);
  const program = getTsProgram(ts, files, "tsconfig.json");

  const sourceFile = program.getSourceFiles().find((sf) => {
    let found = false;
    const visit = (node: ts.Node) => {
      if (ts.isClassDeclaration(node) && node.name?.text === className) {
        found = true;
        return;
      }
      if (!found) ts.forEachChild(node, visit);
    };
    visit(sf);
    return found;
  })!;

  let classNode: ts.ClassDeclaration | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isClassDeclaration(node) && node.name?.text === className) {
      classNode = node;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  const moduleDoc: ModuleDoc = {
    path: sourceFile.fileName,
    declarations: [
      {
        kind: "class",
        name: className,
        members,
      },
    ],
  };

  plugin.analyzePhase({ ts, node: sourceFile, moduleDoc, context: {} });
  plugin.analyzePhase({ ts, node: classNode, moduleDoc, context: {} });
  return moduleDoc;
}

function getMember(moduleDoc: ModuleDoc, name: string): ParsedMember {
  return moduleDoc.declarations[0].members.find(
    (m) => m.name === name,
  ) as ParsedMember;
}

describe("type alias resolution", () => {
  beforeEach(() => {
    process.chdir(fixtureDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    vi.restoreAllMocks();
  });

  test("imported type alias, name unique in program, resolves", () => {
    const moduleDoc = analyzeClass(
      "UniqueConsumer",
      [{ name: "value", type: { text: "Unique" } }],
      ["unique.ts", "unique-consumer.ts"],
    );

    expect(getMember(moduleDoc, "value").parsedType.text).toEqual(
      "'alpha' | 'beta'",
    );
  });

  test("imported type alias whose name is declared in 2+ files resolves to the imported declaration", () => {
    const moduleDoc = analyzeClass(
      "Button",
      [
        {
          name: "size",
          type: { text: "Size | undefined" },
          optional: true,
        },
      ],
      ["button.ts", "control-size.ts", "stale-control-size.d.ts"],
    );

    expect(getMember(moduleDoc, "size").parsedType.text).toEqual(
      "'default' | 'small' | undefined",
    );
  });

  test("two genuinely different types sharing a name each resolve to their own expansion", () => {
    const consumerA = analyzeClass(
      "ConsumerA",
      [{ name: "cfg", type: { text: "Config" } }],
      ["config-a.ts", "config-b.ts", "consumer-a.ts", "consumer-b.ts"],
    );
    const consumerB = analyzeClass(
      "ConsumerB",
      [{ name: "cfg", type: { text: "Config" } }],
      ["config-a.ts", "config-b.ts", "consumer-a.ts", "consumer-b.ts"],
    );

    expect(getMember(consumerA, "cfg").parsedType.text).toEqual(
      "{ source: 'a' }",
    );
    expect(getMember(consumerB, "cfg").parsedType.text).toEqual(
      "{ source: 'b' }",
    );
  });

  test("re-exported type alias resolves", () => {
    const moduleDoc = analyzeClass(
      "ReExportConsumer",
      [{ name: "value", type: { text: "ReExport" } }],
      ["reexport-source.ts", "reexport-barrel.ts", "reexport-consumer.ts"],
    );

    expect(getMember(moduleDoc, "value").parsedType.text).toEqual(
      "'one' | 'two'",
    );
  });

  test("method parameter types resolve", () => {
    const moduleDoc = analyzeClass(
      "Button",
      [
        {
          name: "setSize",
          parameters: [{ name: "size", type: { text: "Size" } }],
        },
      ],
      ["button.ts", "control-size.ts", "stale-control-size.d.ts"],
      { parseParameters: true },
    );

    const method = getMember(moduleDoc, "setSize");
    expect(method.parameters?.[0].parsedType.text).toEqual(
      "'default' | 'small'",
    );
  });

  test("type imported from node_modules resolves to its declared type", () => {
    const moduleDoc = analyzeClass(
      "NodeModulesConsumer",
      [{ name: "slot", type: { text: "Slot" } }],
      ["node-modules-import.ts", "control-size.ts"],
      { parseObjectTypes: "full" },
    );

    expect(getMember(moduleDoc, "slot").parsedType.text).toContain(
      "name: string",
    );
  });

  test("maxParseProperties option lets types over the default limit expand", () => {
    const bailed = analyzeClass(
      "LargeConsumer",
      [{ name: "value", type: { text: "LargeInterface" } }],
      ["large-interface.ts", "large-consumer.ts"],
      { parseObjectTypes: "full" },
    );
    expect(getMember(bailed, "value").parsedType).toBeUndefined();

    const expanded = analyzeClass(
      "LargeConsumer",
      [{ name: "value", type: { text: "LargeInterface" } }],
      ["large-interface.ts", "large-consumer.ts"],
      { parseObjectTypes: "full", maxParseProperties: 100 },
    );
    expect(getMember(expanded, "value").parsedType.text).toContain(
      "prop0: string",
    );
    expect(getMember(expanded, "value").parsedType.text).toContain(
      "prop54: string",
    );
  });

  test("maxParseDepth option lets deeply nested types expand", () => {
    const truncated = analyzeClass(
      "DeepConsumer",
      [{ name: "value", type: { text: "Deep0" } }],
      ["deep-types.ts"],
      { parseObjectTypes: "full" },
    );
    expect(getMember(truncated, "value").parsedType.text).not.toContain(
      "done: boolean",
    );

    const expanded = analyzeClass(
      "DeepConsumer",
      [{ name: "value", type: { text: "Deep0" } }],
      ["deep-types.ts"],
      { parseObjectTypes: "full", maxParseDepth: 12 },
    );
    expect(getMember(expanded, "value").parsedType.text).toContain(
      "done: boolean",
    );
  });

  test('tsconfig "exclude": ["**/dist"] prevents files in dist from being walked', () => {
    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    process.chdir(globExcludeDir);

    getTsProgram(ts, ["dist/bar.ts", "src/foo.ts"], "tsconfig.json");

    const warningOutput = warnSpy.mock.calls
      .map((args) => args.join(" "))
      .join("\n");
    expect(warningOutput).not.toContain("RecursiveDist");
  });
});
