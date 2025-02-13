import path from "path";
import fs from "fs";
import { Logger } from "./logger.js"; // Replace "some-module" with the actual module where Logger is defined
import type * as ts from "typescript";
import type { Component } from "@wc-toolkit/cem-utilities"; // Replace "some-module" with the actual module where Component is defined

export interface Options {
  /** Determines the name of the property used in the manifest to store the expanded type */
  propertyName?: string;
  /** Hides logs produced by the plugin */
  hideLogs?: boolean;
  /** Prevents plugin from executing */
  skip?: boolean;
}

interface AliasTypes {
  [key: string]: {
    [key: string]: string;
  };
}

const aliasTypes: AliasTypes = {};
const groupedTypes: AliasTypes = {};
const primitives = [
  "string",
  "number",
  "boolean",
  "any",
  "null",
  "undefined",
  "unknown",
  "never",
  "void",
  "object",
  "symbol",
  "bigint",
  "true",
  "false",
];
let currentFilename = "";
let typeChecker: ts.TypeChecker;
let options: Options;
let typeScript: typeof import("typescript");
let tsConfigFile: string;

/**
 * CEM Analyzer plugin to expand types in component metadata
 * @param tc TypeScript type checker
 * @param op Configuration options
 * @returns
 */
export function expandTypesPlugin(
  op: Options = {
    propertyName: "expandedType",
  }
) {
  options = op;
  const log = new Logger(!op.hideLogs);
  if (options.skip) {
    log.yellow("[cem-expanded-types] - Skipped");
    return;
  }
  log.log(
    "[cem-expanded-types] - Updating Custom Elements Manifest...");

  return {
    name: "expand-types-plugin",
    collectPhase,
    analyzePhase,
    packageLinkPhase: () => {
      log.green(
        "[cem-expanded-types] - Custom Elements Manifest updated.");
    },
  };
}

/**
 *
 * @param ts Global TypeScript object
 * @param globs File globs to analyze
 * @param configName TypeScript config file name to use during analysis
 * @returns
 */
export function getTsProgram(
  ts: typeof import("typescript"),
  globs: string[],
  configName = "tsconfig.json"
): ts.Program {
  tsConfigFile = ts.findConfigFile(
    process.cwd(),
    ts.sys.fileExists,
    configName
  )!;
  const { config } = ts.readConfigFile(tsConfigFile, ts.sys.readFile);
  const compilerOptions = ts.convertCompilerOptionsFromJson(
    config.compilerOptions ?? {},
    "."
  );
  const program = ts.createProgram(globs, compilerOptions.options);
  typeChecker = program.getTypeChecker();
  return program;
}

function getExpandedType(fileName: string, typeName: string): string {
  if (typeName?.includes("|")) {
    return getUnionTypes(fileName, typeName);
  }

  if (typeName?.startsWith("{") && typeName?.endsWith("}")) {
    return getObjectTypes(fileName, typeName);
  }

  if (
    primitives.includes(typeName) ||
    typeof groupedTypes[typeName] === "undefined"
  ) {
    return typeName;
  }

  if (typeof groupedTypes[typeName][fileName] !== "undefined") {
    return groupedTypes[typeName][fileName];
  }

  if (Object.entries(groupedTypes[typeName]).length === 1) {
    return Object.values(groupedTypes[typeName])[0];
  }

  return typeName;
}

function getUnionTypes(fileName: string, typeName: string): string {
  return (
    typeName
      ?.split("|")
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      ?.map((part) => getExpandedType(fileName, part))
      .join(" | ") || ""
  );
}

function getObjectTypes(fileName: string, typeName: string): string {
  const parts = [
    ...new Set(
      typeName
        ?.split(/[:{}]/)
        .map((part) => part.trim())
        .filter((part) => part.length > 0)
    ),
  ];
  parts.forEach((part) => {
    // remove comments from object
    const cleanPart = part.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, "");
    typeName = typeName.replace(
      cleanPart,
      getExpandedType(fileName, cleanPart)
    );
  });
  return typeName;
}

function collectPhase({
  ts,
  node,
}: {
  ts: typeof import("typescript");
  node: ts.Node;
}) {
  typeScript = ts;
  parseFileTypes(node);
}

function parseFileTypes(node: ts.Node) {
  if ((node as ts.SourceFile)?.fileName?.includes("node_modules")) {
    return;
  }

  if (node.kind === typeScript.SyntaxKind.SourceFile) {
    currentFilename = path.resolve((node as ts.SourceFile).fileName);
    aliasTypes[currentFilename] = {};
  } else if (node.kind === typeScript.SyntaxKind.EnumDeclaration) {
    setEnumTypes(node as ts.EnumDeclaration);
  } else if (node.kind === typeScript.SyntaxKind.TypeAliasDeclaration) {
    if (
      (node as ts.TypeAliasDeclaration).type.kind ===
      typeScript.SyntaxKind.UnionType
    ) {
      setBasicUnionTypes(node as ts.TypeAliasDeclaration);
    } else if (
      (node as ts.TypeAliasDeclaration).type.kind ===
        typeScript.SyntaxKind.TypeOperator ||
      (node as ts.TypeAliasDeclaration).type.kind ===
        typeScript.SyntaxKind.IndexedAccessType
    ) {
      setComplexUnionTypes(node as ts.TypeAliasDeclaration);
    }
  }

  groupTypesByName();
}

function groupTypesByName() {
  for (const alias in aliasTypes) {
    for (const type in aliasTypes[alias]) {
      if (!groupedTypes[type]) {
        groupedTypes[type] = {};
      }
      groupedTypes[type][alias] = aliasTypes[alias][type];
    }
  }
}

function setEnumTypes(node: ts.EnumDeclaration) {
  const name = node.name?.escapedText as string;
  const shortText =
    node.members
      ?.map((mem: ts.EnumMember) => `'${mem.initializer?.getText()}'`)
      .join(" | ") || "";

  aliasTypes[currentFilename][name] = shortText;
}

function setBasicUnionTypes(node: ts.TypeAliasDeclaration) {
  const name = node.name?.escapedText as string;
  const unionTypes =
    (node.type as ts.UnionTypeNode).types
      ?.map((type: ts.TypeNode) => {
        let value = (type as ts.LiteralTypeNode).literal?.getText();
        if (!value && (type as ts.TypeReferenceNode).typeName?.getText()) {
          value = getExpandedType(
            currentFilename,
            (type as ts.TypeReferenceNode).typeName?.getText()
          );
          return value;
        }
        return typeof value === "string" ? `'${value}'` : value;
      })
      .join(" | ") || "";
  aliasTypes[currentFilename][name] = unionTypes;
}

function setComplexUnionTypes(node: ts.TypeAliasDeclaration) {
  const name = node?.name?.escapedText as string;
  const resolvedTypes = typeChecker.getDeclaredTypeOfSymbol(
    typeChecker.getSymbolAtLocation(node.name)!
  );
  const unionTypes =
    (resolvedTypes as ts.UnionType).types
      ?.map((type: ts.Type) =>
        typeof typeChecker.typeToString(type) === "string"
          ? `'${typeChecker.typeToString(type)}'`
          : typeChecker.typeToString(type)
      )
      .join(" | ") || "";

  aliasTypes[currentFilename][name] = unionTypes;
}

interface Context {
  imports: { name: string; importPath: string }[];
}

function analyzePhase({
  ts,
  node,
  moduleDoc,
  context,
}: {
  ts: typeof import("typescript");
  node: ts.Node;
  moduleDoc: { declarations: Component[] };
  context: Context;
}) {
  (moduleDoc as unknown as { path: string }).path = (
    moduleDoc as unknown as { path: string }
  ).path.replace(`${process.cwd()}/`, "");
  if (node.kind === ts.SyntaxKind.SourceFile) {
    currentFilename = path.resolve((node as ts.SourceFile).fileName);
  }

  if (node.kind !== ts.SyntaxKind.ClassDeclaration) {
    return;
  }

  const component = getComponent(
    node as ts.ClassDeclaration,
    moduleDoc as { declarations: Component[] }
  );
  if (!component) {
    return;
  }

  updateExpandedTypes(component, context);
}

function getComponent(
  node: ts.ClassDeclaration,
  moduleDoc: { declarations: Component[] }
): Component | undefined {
  const className = node.name?.getText();
  return moduleDoc.declarations.find(
    (dec: Component) => dec.name === className
  ) as Component | undefined;
}

function getTypedMembers(component: Component) {
  return (
    [
      ...(component.attributes || []),
      ...(component.members || []),
      ...(component.events || []),
    ] as unknown[]
  ).filter((item) => (item as { type?: unknown })?.type);
}

function getTypeValue(item: unknown, context: Context) {
  const importedType = context?.imports?.find(
    (i: { name: string }) => i.name === (item as { type: { text: string } }).type?.text
  );

  if (!importedType) {
    return getExpandedType(currentFilename, (item as { type: { text: string } }).type.text);
  }

  const resolvedPath = getResolvedImportPath(currentFilename, importedType);

  return getExpandedType(resolvedPath, importedType.name);
}

function getResolvedImportPath(importPath: string, importedType: { name: string; importPath: string }): string {
  let resolvedPath = path.resolve(
    path.dirname(currentFilename),
    importedType.importPath
  );

  if (aliasTypes[resolvedPath]) {
    return resolvedPath;
  }

  if (aliasTypes[resolvedPath + ".ts"]) {
    resolvedPath += ".ts";
  } else if (resolvedPath.endsWith(".js")) {
    resolvedPath = `${resolvedPath}`.replace(".js", ".ts");
  } else if (resolvedPath.endsWith(".d.ts")) {
    parseTypeDefinitionTypes(resolvedPath);
    resolvedPath = currentFilename;
  } else if (fs.existsSync(resolvedPath + ".d.ts")) {
    parseTypeDefinitionTypes(resolvedPath + ".d.ts");
    resolvedPath = currentFilename;
  }

  return resolvedPath;
}

function parseTypeDefinitionTypes(source: string) {
  if (!source) {
    return;
  }

  const { config } = typeScript.readConfigFile(tsConfigFile, typeScript.sys.readFile);
  const compilerOptions = typeScript.convertCompilerOptionsFromJson(config.compilerOptions ?? {}, ".");
  const program = typeScript.createProgram([source], compilerOptions.options);
  const sourceFile = program.getSourceFile(source);

  typeScript.forEachChild(sourceFile!, parseFileTypes);
}

function updateExpandedTypes(component: Component, context: Context) {
  const typedMembers = getTypedMembers(component);
  const propName = options.propertyName || "expandedType";

  typedMembers.forEach((member) => {
    const typeValue = getTypeValue(member, context);
    if (typeValue !== (member as { type: { text: string } }).type.text) {
      (member as { [key: string]: unknown })[propName] = {
        text: typeValue,
      };
    }
  });
}
