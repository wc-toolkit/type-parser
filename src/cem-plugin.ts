/* eslint-disable @typescript-eslint/no-explicit-any */
import path from "path";
import fs from "fs";
import { deepMerge, type Component } from "@wc-toolkit/cem-utilities";
import { Logger } from "./logger.js";
import type ts from "typescript";

/** Options for configuring the CEM Type Parser plugin */
export interface Options {
  /** Determines the name of the property used in the manifest to store the parsed type */
  propertyName?: string;
  /** Shows output logs used for debugging */
  debug?: boolean;
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
let typeChecker: any;
let options: Options;
let typeScript: typeof import("typescript");
let tsConfigFile: any;
let log: Logger;
const defaultOptions: Options = {
  propertyName: "parsedType",
};

/**
 * CEM Analyzer plugin to parse types in component metadata
 * @param tc TypeScript type checker
 * @param op Configuration options
 * @returns
 */
export function typeParserPlugin(op: Options) {
  options = deepMerge(defaultOptions, op);
  log = new Logger(options.debug);

  if (options.skip) {
    log.yellow("[type-parser] - Skipped");
    return;
  }
  log.log("[type-parser] - Updating Custom Elements Manifest...");

  return {
    name: "type-parser-plugin",
    analyzePhase,
    packageLinkPhase: () => {
      log.green("[type-parser] - Custom Elements Manifest updated.");
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
  );
  const { config } = ts.readConfigFile(tsConfigFile, ts.sys.readFile);
  const compilerOptions = ts.convertCompilerOptionsFromJson(
    config.compilerOptions ?? {},
    "."
  );
  const program = ts.createProgram(globs, compilerOptions.options);
  const exclusions =
    config.exclude && config.exclude.length
      ? [...config.exclude, "node_modules"]
      : ["node_modules"];
  typeScript = ts;
  typeChecker = program.getTypeChecker();
  for (const sourceFile of program.getSourceFiles()) {
    currentFilename = path.resolve(sourceFile.fileName);
    // exclude files and directories specified in the tsconfig.json including 'node_modules'
    if (!exclusions.some((x: string) => currentFilename.includes(x))) {
      aliasTypes[currentFilename] = {};
      visitNode(sourceFile);
    }
  }
  groupTypesByName();
  return program;
}

function getParsedType(fileName: string, typeName: string): string {
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
      ?.map((part) => getParsedType(fileName, part))
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
    typeName = typeName.replace(cleanPart, getParsedType(fileName, cleanPart));
  });
  return typeName;
}

function getFinalType(type: any): string {
  if(isTsType(type)) {
    return typeChecker.typeToString(type);
  }
  if (type.isUnion()) {
    return type.types.map(getFinalType).join(" | ");
  }
  if (type.isIntersection()) {
    return type.types.map(getFinalType).join(" & ");
  }
  if (type.flags & typeScript.TypeFlags.String) {
    return "string";
  }
  if (type.flags & typeScript.TypeFlags.Number) {
    return "number";
  }
  if (type.flags & typeScript.TypeFlags.Boolean) {
    return "boolean";
  }
  if (type.flags & typeScript.TypeFlags.Unknown) {
    return "unknown";
  }
  if (type.flags & typeScript.TypeFlags.Any) {
    return "any";
  }
  if (type.flags & typeScript.TypeFlags.Void) {
    return "void";
  }
  if (type.flags & typeScript.TypeFlags.Null) {
    return "null";
  }
  if (type.flags & typeScript.TypeFlags.Undefined) {
    return "undefined";
  }
  if (type.flags & typeScript.TypeFlags.Never) {
    return "never";
  }
  if (type.flags & typeScript.TypeFlags.BigInt) {
    return "bigint";
  }
  if (type.flags & typeScript.TypeFlags.ESSymbol) {
    return "symbol";
  }

  if (type.flags & typeScript.TypeFlags.StringLiteral) {
    const value = (type as ts.LiteralType).value as string;
    return `"${value}"`;
  }

  if (
    type.flags & typeScript.TypeFlags.NumberLiteral ||
    type.flags & typeScript.TypeFlags.BigIntLiteral
  ) {
    const value = (type as ts.LiteralType).value as number;
    return `${value}`;
  }

  if (type.flags & typeScript.TypeFlags.Enum) {
    const enumType = type as ts.EnumType;
    const enumMembers = typeChecker.getPropertiesOfType(enumType);
    const enumValues = enumMembers.map((member: { name: any }) => member.name);
    return enumValues.join(" | ");
  }

  // Get properties if the type is an object
  if (type.isClassOrInterface() || type.flags & typeScript.TypeFlags.Object) {
    const properties = typeChecker.getPropertiesOfType(type);
    const props = properties.map(
      (prop: { valueDeclaration: any; name: any }) => {
        const propType = typeChecker.getTypeOfSymbolAtLocation(
          prop,
          prop.valueDeclaration!
        );
        const propTypeString = getFinalType(propType);
        return `${prop.name}: ${propTypeString}`;
      }
    );
    return `{ ${props.join(", ")} }`;
  }

  return typeChecker.typeToString(type);
}

function isTsType(type: ts.Type): boolean {
  const symbol = type.getSymbol();
  if (!symbol) return false;

  const declarations = symbol.getDeclarations();
  if (!declarations || declarations.length === 0) return false;

  return declarations.some((decl) => {
    const sourceFile = decl.getSourceFile();
    return sourceFile.fileName.includes('node_modules/typescript');
  });
}

// Visit each node in the source file
function visitNode(node: any) {
  if (typeScript.isTypeAliasDeclaration(node)) {
    const symbol = typeChecker.getSymbolAtLocation(node.name);
    if (symbol) {
      const type = typeChecker.getDeclaredTypeOfSymbol(symbol);
      const finalType = getFinalType(type);
      log.log(
        `Type alias '${node.name.text}' has final computed type: ${finalType}`
      );
      aliasTypes[currentFilename][node.name.text] = finalType;
    }
  }

  if (typeScript.isEnumDeclaration(node)) {
    const symbol = typeChecker.getSymbolAtLocation(node.name);
    if (symbol) {
      const type = typeChecker.getDeclaredTypeOfSymbol(symbol);
      const finalType = getFinalType(type);
      log.log(
        `Type alias '${node.name.text}' has final computed type: ${finalType}`
      );
      aliasTypes[currentFilename][node.name.text] = finalType;
    }
  }

  typeScript.forEachChild(node, visitNode);
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

function analyzePhase({ ts, node, moduleDoc, context }: any) {
  moduleDoc.path = moduleDoc.path.replace(`${process.cwd()}/`, "");
  if (node.kind === ts.SyntaxKind.SourceFile) {
    currentFilename = path.resolve(node.fileName);
  }

  if (node.kind !== ts.SyntaxKind.ClassDeclaration) {
    return;
  }

  const component = getComponent(node, moduleDoc);
  if (!component) {
    return;
  }

  updateParsedTypes(component, context);
}

function getComponent(node: any, moduleDoc: any) {
  const className = node.name.getText();
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
    ] as any[]
  ).filter((item) => item?.type);
}

function getTypeValue(item: any, context: any) {
  const importedType = context?.imports?.find(
    (i: any) => i.name === item.type?.text
  );

  if (!importedType) {
    return getParsedType(currentFilename, item.type.text);
  }

  const resolvedPath = getResolvedImportPath(currentFilename, importedType);

  return getParsedType(resolvedPath, importedType.name);
}

function getResolvedImportPath(importPath: string, importedType: any) {
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
    resolvedPath = currentFilename;
  } else if (fs.existsSync(resolvedPath + ".d.ts")) {
    resolvedPath = currentFilename;
  }

  return resolvedPath;
}

function updateParsedTypes(component: Component, context: any) {
  const typedMembers = getTypedMembers(component);
  const propName = options.propertyName || "parsedType";

  typedMembers.forEach((member) => {
    const typeValue = getTypeValue(member, context);
    if (typeValue !== member.type.text) {
      member[propName] = {
        text: typeValue.replace(/"/g, "'"),
      };
    }
  });
}
