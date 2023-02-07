import { jest } from '@jest/globals'
import { build, BuildOptions, Loader, Plugin } from 'esbuild'
import { extname, dirname, sep } from 'path'
import { cp, readFile, rm } from 'fs/promises'
import { basename, parse } from 'path'
import { green, red, yellow, white } from 'kleur/colors'
import { gzipSize } from 'gzip-size'
import brotliSizeModule from 'brotli-size'
import prettyBytes from 'pretty-bytes'
import fastGlob from 'fast-glob'
import pkg from 'typescript'
import { makeAllPackagesExternalPlugin, esmDirnamePlugin, baseConfig, getSizeInfo, formatSize } from '../dist/index.esm'

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
