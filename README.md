<h1 align="center">@jsheaven/easybuild</h1>

> Super-fast and simple IIFE, ESM and CJS bundler for JavaScript and TypeScript. Comes with an easy API and CLI. One file in, one file out. Supports node and browser output. Generates `.map` and `.d.ts` files. Minifies and prints the final code size.

<h2 align="center">User Stories</h2>

1. As a developer, I don't want to configure `esbuild` again and again to gain the same results.
2. As a developer, I want to have `esbuild` configured to bundle for `browser` or `node` and generate `CJS`, `ESM` and `IIFE` likewise
3. As a developer, I don't want `esbuild` to fail on `__dirname` and `__filename` not being defined
4. As a developer, I don't want `node_modules` to be bundled in when bundlung for Node.js
5. As a developer, I want to have an API and CLI to simply build one file at a time
6. As a developer, I want to see the file sizes raw, gzip and brotli compressed

<h2 align="center">Features</h2>

- ✅ Configures `esbuild` to simply generate one output (per module type) JavaScript for one input TypeScript/JavaScript
- ✅ Generates `cjs`, `esm` and `iife` invariants automatically
- ✅ Prints the file sizes per compression type `gzip` and `brotli`, when done
- ✅ Just `1077b` nano sized (ESM, gizpped)
- ✅ Available as CLI and API
- ✅ Fixes several unintuitive `esbuild` default behaviours
- ✅ Runs on Windows, Mac, Linux, CI tested
- ✅ First class TypeScript support
- ✅ 100% Unit Test coverage

<h2 align="center">Example usage (CLI)</h2>

For Node.js:
`npx @jsheaven/easybuild ./src/index.ts ./dist/index.js node`

For browsers:
`npx @jsheaven/easybuild ./src/index.ts ./dist/index.js browser`

> You need at least version 18 of [Node.js](https://www.nodejs.org) installed.

<h2 align="center">Example usage (API, as a library)</h2>

<h3 align="center">Setup</h2>

- yarn: `yarn add @jsheaven/easybuild`
- npm: `npm install @jsheaven/easybuild`

<h3 align="center">ESM</h2>

```ts
import { buildForNode, buildForBrowser } from '@jsheaven/easybuild'

await buildForNode({
  // source file to build
  entryPoint: './src/cli.ts',
  // file to generate (actually, generates invariants like ./dist/cli.iife.js, etc.)
  outfile: './dist/cli.js',
  // in case you want to set any extra esbuild options
  esBuildOptions: {
    // usually, Node.js builds are not bundled, but e.g. for CLIs you want that
    bundle: true,
  },
})
```

<h3 align="center">CommonJS</h2>

```ts
const { buildForNode, buildForBrowser } = require('@jsheaven/easybuild')

// same API like ESM variant
```
