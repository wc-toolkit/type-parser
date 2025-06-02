import { getTsProgram, typeParserPlugin } from "./dist/index.js";

export default {
  /** Globs to analyze */
  globs: ["demo/src/**/*.ts"],
  /** Directory to output CEM to */
  outdir: "demo",
  /** Run in dev mode, provides extra logging */
  dev: false,
  /** Output CEM path to `package.json`, defaults to true */
  packagejson: false,
  plugins: [typeParserPlugin({
    debug: false,
    parseObjectTypes: "none"
  })],
  overrideModuleCreation({ ts, globs }) {
    const program = getTsProgram(ts, globs, "tsconfig.json");
    return program
      .getSourceFiles()
      .filter((sf) => globs.find((glob) => sf.fileName.includes(glob)));
  },
};
