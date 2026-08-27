import path from "path";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getTsProgram, typeParserPlugin } from "../cem-plugin.js";

const fixtureDir = path.resolve("src/__fixtures__/mixin");
const originalCwd = process.cwd();

function findClass(sourceFile: ts.SourceFile, name: string) {
  let match: ts.ClassDeclaration | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isClassDeclaration(node) && node.name?.text === name) {
      match = node;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return match;
}

describe("mixin member resolution", () => {
  beforeEach(() => {
    process.chdir(fixtureDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    vi.restoreAllMocks();
  });

  test("resolves members declared on a mixin's inner class", () => {
    const plugin = typeParserPlugin({});
    const program = getTsProgram(ts, ["sized-mixin.ts"], "tsconfig.json");
    const sourceFile = program
      .getSourceFiles()
      .find((sf) => sf.fileName.endsWith("sized-mixin.ts"))!;
    const classNode = findClass(sourceFile, "WithSizeElement")!;

    const size: { type: { text: string }; parsedType?: { text: string } } = {
      type: { text: 'SizeProps["size"]' },
    };
    const moduleDoc = {
      path: sourceFile.fileName,
      declarations: [
        {
          kind: "mixin",
          name: "WithSize",
          members: [{ name: "size", ...size }],
        },
      ],
    };

    plugin.analyzePhase({ ts, node: sourceFile, moduleDoc, context: {} });
    plugin.analyzePhase({ ts, node: classNode, moduleDoc, context: {} });

    const member = moduleDoc.declarations[0].members[0] as typeof size &
      Record<string, unknown>;
    expect(member.parsedType?.text).toEqual("'small' | 'medium' | 'large'");
  });
});
