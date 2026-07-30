/* eslint-disable @typescript-eslint/no-explicit-any */
import path from "path";
import fs from "fs";
import { deepMerge, type Component } from "@wc-toolkit/cem-utilities";
import { Logger } from "./logger.js";
import type ts from "typescript";

export type ParseObjectTypesMode = "none" | "partial" | "full";

/** Options for configuring the CEM Type Parser plugin */
export interface Options {
  /** Controls whether object types are parsed, and if so, whether fully or partially ('none', 'partial', 'full') */
  parseObjectTypes?: ParseObjectTypesMode;
  /** Controls whether method parameters are parsed */
  parseParameters?: boolean;
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

interface ParseContext {
  depth: number;
  fallbackText?: string;
  requestedFileName?: string;
  visited: WeakSet<object>;
}

const aliasTypes: AliasTypes = {};
const groupedTypes: AliasTypes = {};
const loggedParseFailures = new Set<string>();
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
const MAX_PARSE_DEPTH = 8;
const MAX_PARSE_PROPERTIES = 50;

let currentFilename = "";
let typeChecker: any;
let options: Options;
let typeScript: typeof import("typescript");
let log: Logger;

const defaultOptions: Options = {
  parseObjectTypes: "none",
  parseParameters: false,
  propertyName: "parsedType",
};

/**
 * CEM Analyzer plugin to parse types in component metadata
 * @param op Configuration options
 * @returns
 */
export function typeParserPlugin(op: Options = {}) {
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
  configName = "tsconfig.json",
): ts.Program {
  options ??= defaultOptions;
  log ??= new Logger(options.debug);
  resetParserState();

  const diagnosticText = (diagnostic: ts.Diagnostic) =>
    ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");

  const tsConfigFile = ts.findConfigFile(
    process.cwd(),
    ts.sys.fileExists,
    configName,
  );
  if (!tsConfigFile) {
    throw new Error(
      `[type-parser] - Could not find TypeScript config "${configName}".`,
    );
  }

  const parseConfigHost: ts.ParseConfigFileHost = {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic: ts.Diagnostic) => {
      throw new Error(
        `[type-parser] - Could not parse TypeScript config "${configName}": ${diagnosticText(diagnostic)}`,
      );
    },
  };

  const parsedConfig = ts.getParsedCommandLineOfConfigFile(
    tsConfigFile,
    undefined,
    parseConfigHost,
  )!;

  for (const diagnostic of parsedConfig.errors) {
    const message = diagnosticText(diagnostic);
    if (diagnostic.category === ts.DiagnosticCategory.Error) {
      log.warn(`[type-parser] - TypeScript config error: ${message}`);
    } else {
      log.yellow(`[type-parser] - TypeScript config warning: ${message}`);
    }
  }

  const rootFileNames = new Set<string>();
  for (const fileName of [...parsedConfig.fileNames, ...globs]) {
    rootFileNames.add(path.resolve(fileName));
  }

  const program = ts.createProgram([...rootFileNames], parsedConfig.options);
  const exclusions = [...(parsedConfig.raw?.exclude ?? []), "node_modules"];

  typeScript = ts;
  typeChecker = program.getTypeChecker();

  for (const sourceFile of program.getSourceFiles()) {
    currentFilename = path.resolve(sourceFile.fileName);
    if (!exclusions.some((x: string) => currentFilename.includes(x))) {
      aliasTypes[currentFilename] = {};
      visitNode(sourceFile);
    }
  }

  groupTypesByName();
  return program;
}

function resetParserState() {
  currentFilename = "";

  for (const key of Object.keys(aliasTypes)) {
    delete aliasTypes[key];
  }

  for (const key of Object.keys(groupedTypes)) {
    delete groupedTypes[key];
  }

  loggedParseFailures.clear();
}

function normalizeModulePath(modulePath: string, cwd = process.cwd()) {
  return path.relative(cwd, modulePath).split(path.sep).join("/");
}

function createParseContext(
  fileName: string,
  fallbackText?: string,
  depth = 0,
  visited = new WeakSet<object>(),
): ParseContext {
  return {
    depth,
    fallbackText,
    requestedFileName: fileName,
    visited,
  };
}

function createNestedParseContext(
  context: ParseContext,
  fallbackText?: string,
): ParseContext {
  return {
    ...context,
    depth: context.depth + 1,
    fallbackText,
  };
}

function getParsedType(
  fileName: string,
  typeName: string,
  context = createParseContext(fileName, typeName),
): string {
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

  if (typeChecker && typeScript) {
    const sourceFile = typeChecker.getProgram().getSourceFile(fileName);
    if (sourceFile) {
      const symbols = typeChecker.getSymbolsInScope(
        sourceFile,
        typeScript.SymbolFlags.Type,
      );
      const symbol = symbols.find((s: any) => s.name === typeName);
      if (symbol) {
        const type = typeChecker.getDeclaredTypeOfSymbol(symbol);
        return getFinalType(type, context);
      }
    }
  }

  return typeName;
}

function getUnionTypes(fileName: string, typeName: string): string {
  return (
    typeName
      ?.split("|")
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      ?.map((part) =>
        getParsedType(fileName, part, createParseContext(fileName, part)),
      )
      .join(" | ") || ""
  );
}

function getObjectTypes(fileName: string, typeName: string): string {
  const parts = [
    ...new Set(
      typeName
        ?.split(/[:{}]/)
        .map((part) => part.trim())
        .filter((part) => part.length > 0),
    ),
  ];

  parts.forEach((part) => {
    const cleanPart = part.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, "");
    typeName = typeName.replace(
      cleanPart,
      getParsedType(
        fileName,
        cleanPart,
        createParseContext(fileName, cleanPart),
      ),
    );
  });

  return typeName;
}

function getFinalType(type: any, context: ParseContext): string {
  const fallbackText = getSafeTypeName(type, context.fallbackText);
  if (shouldBailOnType(type, context)) {
    return fallbackText;
  }

  if (type.isUnion()) {
    return type.types
      .map((memberType: any) =>
        getFinalType(
          memberType,
          createNestedParseContext(context, fallbackText),
        ),
      )
      .join(" | ");
  }

  if (type.isIntersection()) {
    return type.types
      .map((memberType: any) =>
        getFinalType(
          memberType,
          createNestedParseContext(context, fallbackText),
        ),
      )
      .join(" & ");
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
  if (type.flags & typeScript.TypeFlags.BooleanLiteral) {
    return String((type as any).intrinsicName);
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
    const enumMembers = typeChecker.getPropertiesOfType(type as ts.EnumType);
    return enumMembers
      .map((member: { name: string }) => member.name)
      .join(" | ");
  }

  if (typeChecker.isTupleType?.(type)) {
    const tupleTypes = typeChecker.getTypeArguments(type as ts.TypeReference);
    return `[${tupleTypes
      .map((tupleType: any) =>
        getFinalType(
          tupleType,
          createNestedParseContext(context, fallbackText),
        ),
      )
      .join(", ")}]`;
  }

  if (typeChecker.isArrayType?.(type)) {
    const [elementType] = typeChecker.getTypeArguments(
      type as ts.TypeReference,
    );
    if (!elementType) {
      return `${fallbackText}[]`;
    }

    return `${getFinalType(
      elementType,
      createNestedParseContext(context, fallbackText),
    )}[]`;
  }

  if (type.isClassOrInterface() || type.flags & typeScript.TypeFlags.Object) {
    const trackableType = type as object;
    context.visited.add(trackableType);

    const properties = typeChecker.getPropertiesOfType(type);
    if (properties.length > MAX_PARSE_PROPERTIES) {
      context.visited.delete(trackableType);
      logParseFailure(
        type,
        `type has ${properties.length} properties, which exceeds the limit of ${MAX_PARSE_PROPERTIES}`,
        context,
      );
      return fallbackText;
    }

    const props = properties.map(
      (prop: { valueDeclaration: any; name: string }) =>
        getPropertyTypeText(prop, type, context, fallbackText),
    );

    context.visited.delete(trackableType);
    return `{ ${props.join(", ")} }`;
  }

  return fallbackText;
}

function getPropertyTypeText(
  prop: { valueDeclaration: any; name: string; getDeclarations?: () => any[] },
  parentType: ts.Type,
  context: ParseContext,
  fallbackText: string,
) {
  const declaration = prop.valueDeclaration || prop.getDeclarations?.()?.[0];
  if (!declaration) {
    logParseFailure(
      parentType,
      `property "${prop.name}" does not have a declaration that can be inspected`,
      context,
    );
    return `${prop.name}: ${fallbackText}`;
  }

  const propType = typeChecker.getTypeOfSymbolAtLocation(prop, declaration);
  const propFallbackText = getSafeTypeName(propType, prop.name);
  let typeStr: string;
  let isOptional = false;

  if (propType.isUnion && propType.isUnion()) {
    const types = propType.types;
    const hasUndefined = types.some(
      (t: any) => t.flags & typeScript.TypeFlags.Undefined,
    );
    const nonUndefinedTypes = types.filter(
      (t: any) => !(t.flags & typeScript.TypeFlags.Undefined),
    );

    if (hasUndefined) {
      isOptional = true;
    }

    if (options.parseObjectTypes === "partial") {
      const typeNames = nonUndefinedTypes.map((t: any) => getSafeTypeName(t));
      if (typeNames.every((tStr: string) => primitives.includes(tStr))) {
        typeStr = typeNames.join(" | ");
      } else {
        typeStr = propFallbackText;
      }
    } else {
      typeStr = nonUndefinedTypes
        .map((memberType: any) =>
          getFinalType(
            memberType,
            createNestedParseContext(
              context,
              getSafeTypeName(memberType, prop.name),
            ),
          ),
        )
        .join(" | ");
    }
  } else if (options.parseObjectTypes === "partial") {
    if (primitives.includes(propFallbackText)) {
      typeStr = propFallbackText;
    } else if (
      propType.objectFlags &&
      propType.objectFlags & typeScript.ObjectFlags.Anonymous
    ) {
      typeStr = getFinalType(
        propType,
        createNestedParseContext(context, propFallbackText),
      );
    } else {
      typeStr = propFallbackText;
    }
  } else {
    typeStr = getFinalType(
      propType,
      createNestedParseContext(context, propFallbackText),
    );
  }

  if (!isOptional && typeStr.endsWith(" (optional)")) {
    isOptional = true;
    typeStr = typeStr.replace(" (optional)", "");
  }

  return `${prop.name}${isOptional ? "?" : ""}: ${typeStr}`;
}

function shouldBailOnType(type: ts.Type, context: ParseContext): boolean {
  if (context.depth >= MAX_PARSE_DEPTH) {
    logParseFailure(
      type,
      `type expansion exceeded the maximum depth of ${MAX_PARSE_DEPTH}`,
      context,
    );
    return true;
  }

  if (context.visited.has(type as object)) {
    logParseFailure(type, "detected a recursive type reference", context);
    return true;
  }

  return false;
}

function logParseFailure(type: ts.Type, reason: string, context: ParseContext) {
  const typeName = getSafeTypeName(type, context.fallbackText);
  const location = getTypeLocation(type, context.requestedFileName);
  const cacheKey = `${typeName}|${location}|${reason}`;
  if (loggedParseFailures.has(cacheKey)) {
    return;
  }

  loggedParseFailures.add(cacheKey);
  log.warn(
    `[type-parser] - Skipped parsing type "${typeName}" at ${location}. Reason: ${reason}.`,
  );
}

function getSafeTypeName(type: ts.Type, fallbackText?: string): string {
  const symbol = getPrimaryTypeSymbol(type);
  const symbolName = symbol?.getName();
  if (symbolName && symbolName !== "__type") {
    return symbolName;
  }

  const intrinsicName = (type as any).intrinsicName;
  if (typeof intrinsicName === "string" && intrinsicName !== "__type") {
    return intrinsicName;
  }

  return fallbackText || "unknown";
}

function getPrimaryTypeSymbol(type: ts.Type) {
  const symbol = type.getSymbol?.();
  if (symbol && isNodeModulesSymbol(symbol)) {
    return symbol;
  }

  return type.aliasSymbol || symbol;
}

function getTypeLocation(type: ts.Type, fallbackFileName?: string): string {
  const declaration = getPrimaryTypeSymbol(type)?.getDeclarations?.()?.[0];
  if (declaration) {
    const sourceFile = declaration.getSourceFile();
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(
      declaration.getStart(),
    );
    return `${normalizeModulePath(sourceFile.fileName)}:${line + 1}:${character + 1}`;
  }

  if (fallbackFileName) {
    return normalizeModulePath(fallbackFileName);
  }

  return "unknown location";
}

function isNodeModulesSymbol(symbol: ts.Symbol) {
  const declarations = symbol.getDeclarations();
  if (!declarations || declarations.length === 0) {
    return false;
  }

  return declarations.some((decl) =>
    decl.getSourceFile().fileName.includes("node_modules"),
  );
}

// Visit each node in the source file
function visitNode(node: any) {
  if (
    typeScript.isTypeAliasDeclaration(node) ||
    typeScript.isEnumDeclaration(node) ||
    (typeScript.isInterfaceDeclaration(node) &&
      options.parseObjectTypes !== "none")
  ) {
    const symbol = typeChecker.getSymbolAtLocation(node.name);
    if (symbol) {
      const type = typeChecker.getDeclaredTypeOfSymbol(symbol);
      const finalType = getFinalType(
        type,
        createParseContext(currentFilename, node.name.text),
      );
      log.log(
        `Type alias '${node.name.text}' has final computed type: ${finalType}`,
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
  moduleDoc.path = normalizeModulePath(moduleDoc.path);
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
    (dec: Component) => dec.name === className,
  ) as Component | undefined;
}

function getTypedMembers(component: Component) {
  return (
    [
      ...(component.attributes || []),
      ...(component.members || []),
      ...(component.events || []),
    ] as any[]
  ).filter(
    (item) =>
      item?.type || (options.parseParameters && item?.parameters?.length),
  );
}

function getTypeValue(item: any, context: any) {
  const importedType = context?.imports?.find(
    (i: any) => i.name === item.type?.text,
  );

  if (!importedType) {
    return getParsedType(currentFilename, item.type.text);
  }

  const resolvedPath = getResolvedImportPath(currentFilename, importedType);
  return getParsedType(
    resolvedPath,
    importedType.name,
    createParseContext(resolvedPath, importedType.name),
  );
}

function getResolvedImportPath(importPath: string, importedType: any) {
  let resolvedPath = path.resolve(
    path.dirname(currentFilename),
    importedType.importPath,
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
    if (member.parameters?.length) {
      member.parameters.forEach((param: any, i: number) => {
        if (param.type?.text) {
          const typeValue = getTypeValue(param, context);
          if (typeValue !== param.type.text) {
            member.parameters[i][propName] = {
              text: typeValue.replace(/"/g, "'"),
            };
          }
        }
      });
    } else {
      const typeValue = getTypeValue(member, context);
      if (typeValue !== member.type.text) {
        member[propName] = {
          text: typeValue.replace(/"/g, "'"),
        };
      }
    }
  });
}
