import { build } from 'esbuild'

await build({
  entryPoints: ['./src/index.ts'],
  outdir: 'dist',
})

const easybundle = await import('./dist/index.js')

// build the CLI
easybundle.buildForNode({
  entryPoint: './src/cli.ts',
  outfile: './dist/cli.js',
  debug: process.argv.indexOf('--dev') > -1,
  esBuildOptions: {
    bundle: true,
  },
} as any)

// built the API
easybundle.buildForNode({
  entryPoint: './src/index.ts',
  outfile: './dist/index.js',
  debug: process.argv.indexOf('--dev') > -1,
} as any)
