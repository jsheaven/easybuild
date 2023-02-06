import { build, BuildOptions, Loader, Plugin } from 'esbuild'
import { extname, dirname, sep } from 'path'
import { readFile, rm } from 'fs/promises'
import { basename, parse } from 'path'
import { green, red, yellow, white } from 'kleur/colors'
import { gzipSize } from 'gzip-size'
import brotliSizeModule from 'brotli-size'
import prettyBytes from 'pretty-bytes'
import fastGlob from 'fast-glob'

/** adds spaces from left so that all lines are visually in line vertically */
const getPadLeft = (str: string, width: number, char = ' ') => char.repeat(width - str.length)

/** formats the byte/kByte sizes with coloring */
const formatSize = (size: number, filename: string, type?: string, raw?: boolean) => {
  const pretty = raw ? `${size} B` : prettyBytes(size)
  const color = size < 5000 ? green : size > 40000 ? red : yellow
  const indent = getPadLeft(pretty, 13)
  return `${indent}${color(pretty)}: ${white(basename(filename))}${type ? `.${type}` : ''}`
}

/** returns the text of all file sizes per compression */
const getSizeInfo = async (code: string, filename: string, raw: boolean) => {
  raw = raw || code.length < 5000

  const [gzip, brotli] = await Promise.all([
    gzipSize(code).catch(() => null),
    // @ts-ignore
    brotliSizeModule.default(code).catch(() => null),
  ])

  let out = formatSize(gzip, filename, 'gz', raw)
  if (brotli) {
    out += '\n' + formatSize(brotli, filename, 'br', raw)
  }
  return out
}

/** adds all node_module imports to external so that --bundle in esbuild is not bundling them in */
const makeAllPackagesExternalPlugin: Plugin = {
  name: 'make-all-packages-external',
  setup(build) {
    let filter = /^[^.\/]|^\.[^.\/]|^\.\.[^\/]/ // Must not start with "/" or "./" or "../"
    build.onResolve({ filter }, (args) => ({ path: args.path, external: true }))
  },
}

/** makes sure that all __dirname and __filename occurances are replaced why the actual filenames */
const esmDirnamePlugin: Plugin = {
  name: 'esmDirname',
  setup(build) {
    const nodeModules = new RegExp(/^(?:.*[\\\/])?node_modules(?:[\\\/].*)?$/)
    build.onLoad({ filter: /.*/ }, async ({ path }) => {
      if (!path.match(nodeModules)) {
        let contents = await readFile(path, 'utf8')
        const loader = extname(path).substring(1) as Loader
        const _dirname = dirname(path)
        contents = contents.replaceAll('__dirname', `"${_dirname}"`).replaceAll('__filename', `"${path}"`)
        return {
          contents,
          loader,
        }
      }
    })
  },
}

const baseConfig: BuildOptions = {
  sourcemap: 'external',
  target: 'esnext',
  bundle: true,
  minify: true,
  minifySyntax: true,
  minifyIdentifiers: true,
  minifyWhitespace: true,
  legalComments: 'none',
}

/** prints all file sizes for the generated JS files */
const printFileSizes = async (outfile: string) => {
  const outfileParsed = parse(outfile)
  const jsFiles = await fastGlob(`${outfileParsed.dir}${sep}${outfileParsed.name}*js`)
  jsFiles.forEach(async (jsFilePath) => {
    const code = await readFile(jsFilePath, { encoding: 'utf8' })
    console.log(await getSizeInfo(code, jsFilePath, false))
    console.log(formatSize(Buffer.from(code).byteLength, jsFilePath))
  })
}

/** rewrites the outfile name from e.g. ./dist/index.js to ./dist/index.esm.js, ./dist/index.iife.js */
const getOutfileName = (fileName: string, subType: BuildOptions['format']) => {
  const fileNameParsed = parse(fileName)
  return `${fileNameParsed.dir}${sep}${fileNameParsed.name}.${subType}${fileNameParsed.ext}`
}

/** calls esbuild with a dynamic configuration per format */
const bundle = async ({ entryPoint, outfile, esBuildOptions }) => {
  await Promise.all(
    ['iife', 'esm', 'cjs'].map(async (format: BuildOptions['format']) => {
      await build({
        ...baseConfig,
        format,
        entryPoints: [entryPoint],
        outfile: getOutfileName(outfile, format),
        ...(esBuildOptions || {}),
      } as BuildOptions)
    }),
  )
  printFileSizes(outfile)
}

export interface BundleConfig {
  /** a folder to remove with all contents before the build starts. e.g. ./dist */
  cleanDir?: string

  /** a file to start bundling for. e.g. ./src/index.ts */
  entryPoint: string

  /** a file to write to. e.g. ./dist/index.js */
  outfile: string

  /** esbuild BuildConfig to override internal configuration */
  esBuildOptions?: BuildOptions
}

/** configures esbuild to build one file for a browser environment */
export const bundleForBrowser = async ({ entryPoint, outfile, esBuildOptions }: BundleConfig) =>
  bundle({
    entryPoint,
    outfile,
    esBuildOptions: {
      platform: 'browser',
      plugins: [esmDirnamePlugin],
      ...(esBuildOptions || {}),
    },
  })

/** configures esbuild to build one file for a Node.js environment */
export const bundleForNode = async ({ entryPoint, outfile, esBuildOptions }: BundleConfig) =>
  bundle({
    entryPoint,
    outfile,
    esBuildOptions: {
      platform: 'node',
      plugins: [esmDirnamePlugin, makeAllPackagesExternalPlugin],
      ...(esBuildOptions || {}),
    },
  })
