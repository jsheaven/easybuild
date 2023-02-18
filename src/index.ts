import * as colors from 'kleur/colors'
import { build, BuildOptions, Loader, Plugin } from 'esbuild'
import { extname, dirname, sep } from 'path'
import { readFile } from 'fs/promises'
import { basename, parse } from 'path'
import { green, red, yellow, white } from 'kleur/colors'
import { gzipSize } from 'gzip-size'
import brotliSizeModule from 'brotli-size'
import prettyBytes from 'pretty-bytes'
import fastGlob from 'fast-glob'
import { writeFileSync } from 'fs'
import { generateDtsBundle, LibrariesOptions, OutputOptions } from 'dts-bundle-generator'
import { debug, info, log, time, timeEnd } from '@jsheaven/status-message'

/** output formats to generate */
export const outputFormats: Array<BuildOptions['format']> = ['iife', 'esm', 'cjs']

/** adds spaces from left so that all lines are visually in line vertically */
export const getPadLeft = (str: string, width: number, char = ' ') => char.repeat(width - str.length)

/** formats the byte/kByte sizes with coloring */
export const formatSize = (size: number, filename: string, type?: string, raw?: boolean) => {
  const pretty = raw ? `${size} B` : prettyBytes(size)
  const color = size < 5000 ? green : size > 40000 ? red : yellow
  const indent = getPadLeft(pretty, 13)
  return `${indent}${color(pretty)}: ${white(basename(filename))}${type ? `.${type}` : ''}`
}

/** returns the text of all file sizes per compression */
export const getSizeInfo = async (code: string, filename: string, raw: boolean) => {
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
export const makeAllPackagesExternalPlugin: Plugin = {
  name: 'make-all-packages-external',
  setup(build) {
    let filter = /^[^.\/]|^\.[^.\/]|^\.\.[^\/]/ // Must not start with "/" or "./" or "../"
    build.onResolve({ filter }, (args) => ({ path: args.path, external: true }))
  },
}

/** makes sure that all __dirname and __filename occurances are replaced why the actual filenames */
export const esmDirnamePlugin: Plugin = {
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

/** default baseConfig for esbuild */
export const baseConfig: BuildOptions = {
  sourcemap: 'linked',
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
  log('DONE', 'Generated in', outfileParsed.dir, ':')
  const jsFiles = await fastGlob(`${outfileParsed.dir}${sep}${outfileParsed.name}*{js,map,d.ts}`)

  for (let i = 0; i < jsFiles.length; i++) {
    const jsFilePath = jsFiles[i]
    const code = await readFile(jsFilePath, { encoding: 'utf8' })
    console.log(await getSizeInfo(code, jsFilePath, false))
    console.log(formatSize(Buffer.from(code).byteLength, jsFilePath))
  }
}

/** rewrites the outfile name from e.g. ./dist/index.js to ./dist/index.esm.js, ./dist/index.iife.js */
export const getOutfileName = (fileName: string, subType: BuildOptions['format']) => {
  const fileNameParsed = parse(fileName)
  return `${fileNameParsed.dir}${sep}${fileNameParsed.name}.${subType}${fileNameParsed.ext}`
}

/** options applied, when debug is enabled */
export const debugBuildOptions: Partial<BuildOptions> = {
  minify: false,
  minifySyntax: false,
  minifyIdentifiers: false,
  minifyWhitespace: false,
}

/** calls esbuild with a dynamic configuration per format */
export const genericBuild = async ({
  entryPoint,
  outfile,
  esBuildOptions,
  debug: isDebug,
  dts,
  tsConfigPath,
  dtsLibOptions,
  dtsOutputOptions,
}: BundleConfig) => {
  time('BUNDLE IN')

  if (isDebug) {
    // override minification parameters
    // but let the user still influence them
    esBuildOptions = {
      ...esBuildOptions,
      ...debugBuildOptions,
    } as BuildOptions

    debug(
      'CONFIG',
      'easybundle',
      {
        entryPoint,
        outfile,
        esBuildOptions,
        debug: isDebug,
        dts,
        tsConfigPath,
        dtsLibOptions,
        dtsOutputOptions,
      },
      'esbuild plugins',
      esBuildOptions.plugins,
    )
  }

  time('BUILT IN')
  info('BUILD', 'Transpiling', entryPoint, '...')

  await Promise.all(
    outputFormats.map(async (format: BuildOptions['format']) =>
      build({
        format,
        entryPoints: [entryPoint],
        outfile: getOutfileName(outfile, format),
        ...(esBuildOptions || {}),
      } as BuildOptions),
    ),
  )
  timeEnd('BUILT IN')

  if (dts) {
    time('DTS IN')
    info('DTS', 'Generating .d.ts files...')
    const dTsBundles = generateDtsBundle(
      [
        {
          filePath: entryPoint,
          libraries: dtsLibOptions,
          output: dtsOutputOptions,
        },
      ],
      { preferredConfigPath: tsConfigPath },
    )

    for (let i = 0; i < outputFormats.length; i++) {
      const format = outputFormats[i]
      const outFileNameParsed = parse(getOutfileName(outfile, format))
      const declarationOutFile = `${outFileNameParsed.dir}${sep}${outFileNameParsed.name}.d.ts`
      writeFileSync(declarationOutFile, dTsBundles[0], { encoding: 'utf-8' })
    }
    timeEnd('DTS IN')
  }
  await printFileSizes(outfile)

  timeEnd('BUNDLE IN')
}

export interface BundleConfig {
  /** shall the output not be minified and treeShaked but left readable?  default: false */
  debug?: boolean

  /** a file to start bundling for. e.g. ./src/index.ts */
  entryPoint: string

  /** a file to write to. e.g. ./dist/index.js */
  outfile: string

  /** shall the output include .d.ts type declarations? (takes much longer to compile); default: true */
  dts?: boolean

  /** allows to inline types of libraries etc. */
  dtsLibOptions?: LibrariesOptions

  /** allows to control .d.ts. bundle specifics */
  dtsOutputOptions?: OutputOptions

  /** path to a tsconfig.json file, if existing; default: 'tsconfig.json' */
  tsConfigPath?: string

  /** esbuild BuildConfig to override internal configuration */
  esBuildOptions?: BuildOptions
}

export const genericDefaultBundleConifg: Partial<BundleConfig> = {
  dts: true,
  tsConfigPath: 'tsconfig.json',
  dtsOutputOptions: {
    exportReferencedTypes: true,
    inlineDeclareExternals: true,
    inlineDeclareGlobals: true,
    noBanner: true,
    sortNodes: true,
  },
}

export const defaultBundleConfigBrowser: Partial<BundleConfig> = {
  ...genericDefaultBundleConifg,
  esBuildOptions: {
    ...baseConfig,
    platform: 'browser',
    plugins: [esmDirnamePlugin],
  },
}

export const defaultBundleConfigNode: Partial<BundleConfig> = {
  ...genericDefaultBundleConifg,
  esBuildOptions: {
    ...baseConfig,
    platform: 'node',
    plugins: [esmDirnamePlugin, makeAllPackagesExternalPlugin],
  },
}

/** configures esbuild to build one file for a browser environment; defaults: defaultBundleConfigBrowser  */
export const buildForBrowser = async (config: BundleConfig) =>
  genericBuild({
    ...defaultBundleConfigBrowser,
    ...config,
    dtsOutputOptions: {
      ...defaultBundleConfigBrowser.dtsOutputOptions,
      ...(config.dtsOutputOptions || {}),
    },
    esBuildOptions: {
      ...defaultBundleConfigBrowser.esBuildOptions,
      ...(config.esBuildOptions || {}),
    },
  })

/** configures esbuild to build one file for a Node.js environment; defaults: defaultBundleConfigNode */
export const buildForNode = async (config: BundleConfig) =>
  genericBuild({
    ...defaultBundleConfigNode,
    ...config,
    dtsOutputOptions: {
      ...defaultBundleConfigNode.dtsOutputOptions,
      ...(config.dtsOutputOptions || {}),
    },
    esBuildOptions: {
      ...defaultBundleConfigNode.esBuildOptions,
      ...(config.esBuildOptions || {}),
    },
  })
