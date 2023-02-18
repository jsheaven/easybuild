import { build } from 'esbuild'
import { debugBuildOptions } from './src/index.js'

console.log('Building easybundle...')

await build({
  entryPoints: ['./src/index.ts'],
  outdir: 'dist',
  ...(process.argv.indexOf('--dev') > -1 ? debugBuildOptions : {}),
})

const easybundle = await import('./dist/index.js')

// build the CLI
await easybundle.buildForNode({
  entryPoint: './src/cli.ts',
  outfile: './dist/cli.js',
  debug: process.argv.indexOf('--dev') > -1,
  esBuildOptions: {
    bundle: true,
  },
} as any)

// built the API
await easybundle.buildForNode({
  entryPoint: './src/index.ts',
  outfile: './dist/index.js',
  debug: process.argv.indexOf('--dev') > -1,
} as any)
