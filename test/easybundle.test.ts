import { jest } from '@jest/globals'
import { build, BuildOptions, Loader, Plugin } from 'esbuild'
import { extname, dirname, sep, resolve } from 'path'
import { cp, readFile, rm } from 'fs/promises'
import { basename, parse } from 'path'
import { green, red, yellow, white } from 'kleur/colors'
import { gzipSize } from 'gzip-size'
import brotliSizeModule from 'brotli-size'
import prettyBytes from 'pretty-bytes'
import fastGlob from 'fast-glob'
import pkg, { EmitResult } from 'typescript'
import {
  makeAllPackagesExternalPlugin,
  esmDirnamePlugin,
  baseConfig,
  getSizeInfo,
  formatSize,
  getPadLeft,
  generateTypeDeclarations,
  genericBuild,
} from '../dist/index.esm'

jest.mock('fs/promises', () => ({
  cp: jest.fn().mockReturnValueOnce(() => {}),
  readFile: jest.fn().mockReturnValueOnce('file contents'),
  rm: jest.fn().mockReturnValueOnce(() => {}),
}))
jest.mock('gzip-size', () => jest.fn().mockReturnValueOnce(10))
jest.mock('brotli-size', () => jest.fn().mockReturnValueOnce(5))
jest.mock('fast-glob', () => jest.fn().mockReturnValueOnce(['file1.js', 'file2.js']))

describe('getSizeInfo', () => {
  it('returns the correct size information for a file', async () => {
    const code = 'file contents'
    const filename = 'file.js'
    const result = await getSizeInfo(code, filename, false)
    expect(result.indexOf('33 B') > -1).toEqual(true)
    expect(result.indexOf('17 B') > -1).toEqual(true)
  })
})

describe('formatSize', () => {
  test('should format size with color and filename for smaller sizes', () => {
    const size = 2000
    const filename = 'index.js'
    const result = formatSize(size, filename)

    expect(result).toContain('2 kB')
  })

  test('should format size with color and filename for larger sizes', () => {
    const size = 50000
    const filename = 'index.js'
    const result = formatSize(size, filename)

    expect(result).toContain('50 kB')
  })

  test('should format size with type, color and filename', () => {
    const size = 2000
    const filename = 'index.js'
    const type = 'gz'
    const result = formatSize(size, filename, type)

    expect(result).toContain('2 kB')
  })

  test('should format raw size with color and filename', () => {
    const size = 2000
    const filename = 'index.js'
    const result = formatSize(size, filename, undefined, true)

    expect(result).toContain('2000 B')
  })
})

describe('getPadLeft', () => {
  test('should pad the string with spaces on the left', () => {
    const str = 'hello'
    const width = 10
    const result = getPadLeft(str, width)

    expect(result).toEqual('     ')
  })

  test('should pad the string with custom characters on the left', () => {
    const str = 'hello'
    const width = 10
    const char = '-'
    const result = getPadLeft(str, width, char)

    expect(result).toEqual('-----')
  })

  test('should not pad the string if it is already at the required width', () => {
    const str = 'hello'
    const width = 5
    const result = getPadLeft(str, width)

    expect(result).toEqual('')
  })
})

describe('makeAllPackagesExternalPlugin', () => {
  test('should make all packages external', () => {
    const build = {
      onResolve: jest.fn(),
    }
    makeAllPackagesExternalPlugin.setup(build as any)

    expect(build.onResolve).toHaveBeenCalledWith({ filter: /^[^.\/]|^\.[^.\/]|^\.\.[^\/]/ }, expect.any(Function))
  })
})

describe('esmDirnamePlugin', () => {
  test('should not replace __dirname and __filename occurrences in node_modules', async () => {
    const build = {
      onLoad: jest.fn(async ({ path }) => ({ contents: `console.log(__dirname, __filename)`, loader: 'js' })),
    }
    esmDirnamePlugin.setup(build as any)
    const result = await build.onLoad({ path: '/path/to/node_modules/file.js' })

    expect(result.contents).toContain('__dirname')
    expect(result.contents).toContain('__filename')
  })
})

describe('baseConfig', () => {
  test('should contain basic configuration options for esbuild', () => {
    expect(baseConfig).toEqual({
      sourcemap: 'linked',
      target: 'esnext',
      bundle: true,
      minify: true,
      minifySyntax: true,
      minifyIdentifiers: true,
      minifyWhitespace: true,
      legalComments: 'none',
    })
  })
})

describe('generateTypeDeclarations', () => {
  test('should generate type declarations for entrypoint file', async () => {
    const entryPointFile = './src/index.ts'
    const outDir = './dist'
    const result: EmitResult = (await generateTypeDeclarations(entryPointFile, outDir)) as unknown as EmitResult

    console.log('result', result)

    expect(result.emitSkipped).toEqual(false)
  })
})

/*
describe('genericBuild', () => {
  test('should call esbuild with dynamic configuration per format', async () => {
    const options = {
      entryPoint: resolve('./src/index.ts'),
      outfile: resolve('./dist/index_test.js'),
      debug: false,
      esBuildOptions: {
        platform: 'node',
        plugins: [esmDirnamePlugin],
        target: 'es2019',
      },
    }
    await genericBuild(options)
  })
})
*/
