/* eslint-disable @typescript-eslint/no-explicit-any */
import path from "path";
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
  /** Maximum depth to which nested types are expanded before bailing (default: 8) */
  maxParseDepth?: number;
  /** Maximum number of properties a type can have before bailing (default: 50) */
  maxParseProperties?: number;
  /** Shows output logs used for debugging */
  debug?: boolean;
  /** Prevents plugin from executing */
  skip?: boolean;
}

interface ParseContext {
  depth: number;
  fallbackText?: string;
  requestedFileName?: string;
  visited: WeakSet<object>;
}

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
let program: any;
let options: Options;
let typeScript: typeof import("typescript");
let log: Logger;

let parsedTypeCache: WeakMap<object, string> = new WeakMap();

const defaultOptions: Options = {
  parseObjectTypes: "none",
  parseParameters: false,
  propertyName: "parsedType",
  maxParseDepth: MAX_PARSE_DEPTH,
  maxParseProperties: MAX_PARSE_PROPERTIES,
  debug: false,
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

  program = ts.createProgram([...rootFileNames], parsedConfig.options);

  typeScript = ts;
  typeChecker = program.getTypeChecker();

  const configDir = path.dirname(tsConfigFile);

  const parsedGlobs = ts.parseJsonConfigFileContent(
    {
      include: globs,
      exclude: parsedConfig.raw?.exclude ?? [],
    },
    parseConfigHost,
    configDir,
    undefined,
    tsConfigFile,
  );

  const analyzeFiles = new Set<string>();
  for (const fileName of parsedConfig.fileNames) {
    analyzeFiles.add(path.resolve(fileName));
  }
  for (const fileName of parsedGlobs.fileNames) {
    analyzeFiles.add(path.resolve(configDir, fileName));
  }

  for (const sourceFile of program.getSourceFiles()) {
    currentFilename = path.resolve(sourceFile.fileName);
    if (
      !currentFilename.includes("node_modules") &&
      analyzeFiles.has(currentFilename)
    ) {
      visitNode(sourceFile);
    }
  }

  return program;
}

export function getTypeChecker(): any {
  return typeChecker;
}

export function getProgram(): any {
  return program;
}

function resetParserState() {
  currentFilename = "";
  loggedParseFailures.clear();
  parsedTypeCache = new WeakMap();
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

function getParameterNode(methodNode: any, paramName: string) {
  if (!methodNode?.parameters) {
    return undefined;
  }

  return methodNode.parameters.find(
    (param: any) => param.name?.getText?.() === paramName,
  );
}

function getTypeValue(member: any, memberNode: any) {
  const fallbackText = member.type?.text;

  if (memberNode) {
    const type = getTypeAtNode(memberNode);
    if (!type) {
      return fallbackText;
    }

    if (!shouldExpandType(type)) {
      return fallbackText;
    }

    const resolved = getFinalType(
      type,
      createParseContext(currentFilename, fallbackText),
    );
    return normalizeUndefinedLast(resolved);
  }

  const sourceFile = program?.getSourceFile(currentFilename);
  if (!sourceFile) {
    return fallbackText;
  }

  return resolveTypeTextByName(sourceFile, fallbackText);
}

function getTypeAtNode(memberNode: any) {
  try {
    return typeChecker.getTypeAtLocation(memberNode);
  } catch {
    return undefined;
  }
}

function shouldExpandType(type: any) {
  if (options.parseObjectTypes !== "none") {
    return true;
  }

  if (type.flags & typeScript.TypeFlags.Enum) {
    return true;
  }

  const isObjectLike =
    type.isClassOrInterface?.() || type.flags & typeScript.TypeFlags.Object;
  if (!isObjectLike) {
    return true;
  }

  return Boolean(type.aliasSymbol);
}

function resolveTypeTextByName(
  sourceFile: any,
  typeText?: string,
): string | undefined {
  if (!typeText) {
    return typeText;
  }

  const typeName = typeText.trim();
  if (typeName.startsWith("{") && typeName.endsWith("}")) {
    return typeText;
  }

  if (typeName.includes("|")) {
    return splitUnionMembers(typeName)
      .map((part) => resolveTypeTextByName(sourceFile, part) ?? part)
      .join(" | ");
  }

  if (primitives.includes(typeName)) {
    return typeText;
  }

  const symbol = findTypeSymbol(sourceFile, typeName);
  if (!symbol) {
    return typeText;
  }

  const type = getDeclaredTypeOfSymbol(symbol);
  if (!type || !shouldExpandType(type)) {
    return typeText;
  }

  const resolved = getFinalType(
    type,
    createParseContext(currentFilename, typeName),
  );
  return normalizeUndefinedLast(resolved);
}

function findTypeSymbol(sourceFile: any, name: string) {
  let symbol: any;
  const visit = (node: any) => {
    if (symbol) {
      return;
    }

    if (
      (typeScript.isTypeAliasDeclaration(node) ||
        typeScript.isInterfaceDeclaration(node) ||
        typeScript.isEnumDeclaration(node)) &&
      node.name?.text === name
    ) {
      symbol = typeChecker.getSymbolAtLocation(node.name);
      return;
    }

    typeScript.forEachChild(node, visit);
  };
  visit(sourceFile);

  if (symbol) {
    return symbol;
  }

  for (const stmt of sourceFile.statements) {
    if (!typeScript.isImportDeclaration(stmt) || !stmt.importClause) {
      continue;
    }

    const namedBindings = stmt.importClause.namedBindings;
    if (!namedBindings || !typeScript.isNamedImports(namedBindings)) {
      continue;
    }

    const specifier = namedBindings.elements.find(
      (el: any) => el.name.text === name,
    );
    if (specifier) {
      return typeChecker.getSymbolAtLocation(specifier.name);
    }
  }

  return undefined;
}

function getDeclaredTypeOfSymbol(symbol: any) {
  if (symbol.flags & typeScript.SymbolFlags.Alias) {
    return typeChecker.getDeclaredTypeOfSymbol(
      typeChecker.getAliasedSymbol(symbol),
    );
  }
  return typeChecker.getDeclaredTypeOfSymbol(symbol);
}

function normalizeUndefinedLast(typeText: string): string {
  const members = splitUnionMembers(typeText);
  if (!members.includes("undefined")) {
    return typeText;
  }

  return [
    ...members.filter((member) => member !== "undefined"),
    "undefined",
  ].join(" | ");
}

function splitUnionMembers(typeText: string): string[] {
  const parts: string[] = [];
  let current = "";
  let inQuote = false;

  for (let i = 0; i < typeText.length; i++) {
    const char = typeText[i];
    if (char === "'" || char === '"') {
      if (i === 0 || typeText[i - 1] !== "\\") {
        inQuote = !inQuote;
      }
    }

    if (char === "|" && !inQuote) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  parts.push(current.trim());
  return parts;
}

function getFinalType(type: any, context: ParseContext): string {
  if (context.depth === 0 && type != null && parsedTypeCache.has(type)) {
    return parsedTypeCache.get(type)!;
  }

  const result = getFinalTypeUncached(type, context);
  if (context.depth === 0 && type != null) {
    parsedTypeCache.set(type, result);
  }
  return result;
}

function getFinalTypeUncached(type: any, context: ParseContext): string {
  const fallbackText = getSafeTypeName(type, context.fallbackText);
  if (shouldBailOnType(type, context)) {
    return fallbackText;
  }

  if (type.flags & typeScript.TypeFlags.Boolean) {
    return "boolean";
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
    const maxProperties = options.maxParseProperties ?? MAX_PARSE_PROPERTIES;
    if (properties.length > maxProperties) {
      context.visited.delete(trackableType);
      logParseFailure(
        type,
        `type has ${properties.length} properties, which exceeds the limit of ${maxProperties}`,
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

  if (propType.flags & typeScript.TypeFlags.Boolean) {
    typeStr = "boolean";
  } else if (propType.isUnion && propType.isUnion()) {
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
  const maxDepth = options.maxParseDepth ?? MAX_PARSE_DEPTH;
  if (context.depth >= maxDepth) {
    logParseFailure(
      type,
      `type expansion exceeded the maximum depth of ${maxDepth}`,
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
      const type = getDeclaredTypeOfSymbol(symbol);
      const finalType = getFinalType(
        type,
        createParseContext(currentFilename, node.name.text),
      );
      log.log(
        `Type alias '${node.name.text}' has final computed type: ${finalType}`,
      );
    }
  }

  typeScript.forEachChild(node, visitNode);
}

function analyzePhase({ ts, node, moduleDoc }: any) {
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

  updateParsedTypes(component, node);
}

function getComponent(node: any, moduleDoc: any) {
  const className = node.name.getText();
  const declarations = (moduleDoc.declarations ?? []) as Component[];

  const factoryName = getEnclosingFactoryName(node);
  if (factoryName) {
    const mixin = declarations.find(
      (dec) => (dec as any).kind === "mixin" && dec.name === factoryName,
    );
    if (mixin) {
      return mixin as Component;
    }
  }

  return declarations.find((dec) => dec.name === className) as
    | Component
    | undefined;
}

function getEnclosingFactoryName(node: any): string | undefined {
  let current = node.parent;
  while (current) {
    if (typeScript.isVariableDeclaration(current) && current.name) {
      return current.name.getText();
    }
    if (
      (typeScript.isFunctionDeclaration(current) ||
        typeScript.isFunctionExpression(current)) &&
      current.name
    ) {
      return current.name.getText();
    }
    current = current.parent;
  }
  return undefined;
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

function updateParsedTypes(component: Component, classNode: any) {
  const typedMembers = getTypedMembers(component);
  const propName = options.propertyName || "parsedType";

  const memberNodes = new Map<string, any>();
  for (const node of classNode?.members ?? []) {
    const nodeName = node.name?.getText?.();
    if (nodeName) {
      memberNodes.set(nodeName, node);
    }
  }

  typedMembers.forEach((member) => {
    const memberNode = memberNodes.get(member.fieldName ?? member.name);

    if (member.parameters?.length) {
      member.parameters.forEach((param: any, i: number) => {
        if (param.type?.text) {
          const paramNode = getParameterNode(memberNode, param.name);
          const typeValue = getTypeValue(param, paramNode);
          if (typeValue !== param.type.text) {
            member.parameters[i][propName] = {
              text: typeValue.replace(/"/g, "'"),
            };
          }
        }
      });
    } else if (member.type?.text) {
      const typeValue = getTypeValue(member, memberNode);
      if (typeValue !== member.type.text) {
        member[propName] = {
          text: typeValue.replace(/"/g, "'"),
        };
      }
    }
  });
}
