#!/usr/bin/env node
'use strict'

const entryPoint = process.argv[2] || './src/index.ts'
const outfile = process.argv[3] || './dist/index.js'
const platform = process.argv[4] || 'node'

if (platform === 'browser') {
  import('./index').then(({ bundleForBrowser }) =>
    bundleForBrowser({
      entryPoint,
      outfile,
    }),
  )
} else {
  import('./index').then(({ bundleForNode }) =>
    bundleForNode({
      entryPoint,
      outfile,
    }),
  )
}
