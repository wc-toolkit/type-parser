import { customJSDocTagsPlugin} from './dist/index.js';

export default {
  /** Globs to analyze */
  globs: ['demo/src/**/*.js'],
  /** Directory to output CEM to */
  outdir: 'demo',
  /** Run in dev mode, provides extra logging */
  dev: true,
  /** Output CEM path to `package.json`, defaults to true */
  packagejson: false,
  plugins: [
    customJSDocTagsPlugin({
      tags: {
        status: {
          description: 'Status of the component',
        },
        dependency: {
          isArray: true,
          mappedName: 'dependencies',
        },
      }
    })
  ],
}