import {ask, fileExists, mkdir, saveFile} from '@snickbit/node-utilities'
import {$out, indexer_banner, posix} from './common'
import {AppConfig, DefaultFileExport, IndexConfig, IndexerConfig, IndexerResults} from './definitions'
import {camelCase, isArray, JSONPrettify, objectFindKey, safeVarName, slugify, snakeCase} from '@snickbit/utilities'
import path from 'path'
import fg from 'fast-glob'
import picomatch from 'picomatch'
import fs from 'fs'
import readline from 'readline'

export async function generateIndexes(appConfig: AppConfig, config?: IndexerConfig): Promise<IndexerConfig> {
	let indexer_config: IndexerConfig
	let conf: IndexerConfig

	if (config || appConfig.indexer) {
		conf = config || appConfig.indexer as IndexerConfig
	} else {
		const source = appConfig.source || await ask('Source glob pattern:', {initial: 'src/**/*.ts'})
		const output = appConfig.output || await ask('Output file:', {initial: source.replace(/(\*+\/?)+/, 'index.ts')})
		const type = await ask('Export type:', {
			type: 'select',
			choices: [
				{
					title: `Wildcard export "export * from './path/to/filename'"`,
					value: 'wildcard'
				},
				{
					title: `Default export "export {default as filename} from './path/to/filename'",`,
					value: 'default'
				},
				{
					title: `Group export "export * as filename from './path/to/filename'"`,
					value: 'group'
				},
				{
					title: `Slug export "export * as path_to_filename from './path/to/filename'"`,
					value: 'slug'
				}
			]
		})

		indexer_config = conf = {
			source,
			output,
			type
		}
	}

	getOutputs(config)

	if (!conf.source && !conf.indexes) {
		$out.fatal('Source glob pattern or indexes is required')
	}
	if (!conf.output) {
		$out.fatal('Output file is required')
	}
	if (!conf.type) {
		conf.type = 'wildcard'
	}

	const content: string[] = []
	const results: IndexerResults[] = []

	const source = posix.dirname(conf.output)
	const indexes: Record<string, string[]> = {[source]: []}

	const files = await fg(conf.source, {ignore: makeIgnore(conf), onlyFiles: !conf.recursive})
	if (!files.length) {
		results.push({
			type: 'warn',
			message: `No files found matching source\n${JSONPrettify(conf.source)}`
		})
	}

	for (const file of files) {
		if (await shouldIgnore(conf, file)) {
			$out.warn(`Ignoring file: ${file}`)
			continue
		}

		if (conf.recursive) {
			const dirname = posix.dirname(file)
			if (!indexes[dirname]) {
				indexes[dirname] = []
			}

			indexes[dirname].push(file.replace(/\.[jt]s$/, ''))
		} else {
			content.push(makeExport(conf, source, file))
		}
	}

	if (conf.recursive) {
		indexes[source].push(...await fg(`${source}/*`, {onlyDirectories: true}) || [])

		// loop indexes and write each index
		const ext = path.extname(conf.output)
		for (const [dir, files] of Object.entries(indexes)) {
			const indexFile = posix.join(dir, `index${ext}`)
			const indexContent: string[] = []
			for (const file of files) {
				indexContent.push(makeExport(conf, indexFile, file))
			}

			if (indexContent.length > 0) {
				if (!appConfig.dryRun) {
					await saveIndex(conf, indexFile, indexContent)
				}
				results.push({
					type: 'success',
					message: `${indexContent.length} exports written to ${indexFile}`
				})
			} else if ($out.isVerbose(1)) {
				results.push({
					type: 'warn',
					message: `No exports to write for index: ${indexFile}`
				})
			}
		}
	}

	if (content.length > 0) {
		if (!appConfig.dryRun) {
			await saveIndex(conf, conf.output, content)
		}
		results.push({
			type: 'success',
			message: `${content.length} exports written to ${conf.output}`
		})
	} else if ($out.isVerbose(1)) {
		results.push({
			type: 'warn',
			message: `No exports to write for index: ${conf.output}`
		})
	}

	if (results.length) {
		if (appConfig.dryRun) {
			$out.info('DRY RUN : No changes have been made to the filesystem')
		}
		for (const result of results) {
			if ($out[result.type]) {
				$out[result.type](result.message)
			} else {
				$out.info(result.message)
			}
		}
	}

	return indexer_config
}

let _outputs: string[]

function getOutputs(indexerConfig: IndexerConfig): string[] {
	if (!_outputs) {
		const indexes = indexerConfig?.indexes || [indexerConfig]

		_outputs = indexes.filter(index => index?.output).map(index => index.output)
	}
	return _outputs
}

function resolvePath(source: string, file: string): string {
	const resolvedIndex = posix.resolve(source)
	const resolvedFile = posix.resolve(file)
	let file_path = posix.relative(resolvedIndex, resolvedFile)
		.replace(/^(\.\.)?\/?/, './')
		.replace(/\.[jt]s$/, '')
		.replace(/\/index$/, '')
	if (file_path === '.') {
		file_path = './index'
	}
	return file_path
}

function makeExport(conf: IndexerConfig, source: string, file: string) {
	const override = conf.overrides && objectFindKey(conf.overrides, key => picomatch(key)(file)) as string
	const export_type = override ? conf.overrides[override] : conf.type
	const file_path = resolvePath(source, file)
	const dirname = path.dirname(file)
	const filename = path.basename(file_path, path.extname(file))

	if (export_type === 'slug') {
		const slug = safeVarName(slugify(path.join(dirname, filename)))
		return `export * as ${slug} from '${file_path}'`
	}
	const export_name = makeExportName(filename, conf.casing)

	switch (export_type) {
		case 'group': {
			return `export * as ${export_name} from '${file_path}'`
		}
		case 'individual':
		case 'wildcard': {
			return `export * from '${file_path}'`
		}
		default: {
			return `export {default as ${export_name}} from '${file_path}'`
		}
	}
}

async function saveIndex(indexConf: IndexConfig, filePath: string, content: string[]) {
	mkdir(path.dirname(filePath), true)

	content = content.sort()

	if (indexConf.default && indexConf.default.source) {
		content = await makeDefaultExport(indexConf, content)
	}

	saveFile(filePath, `${indexer_banner}\n\n${content.join('\n')}\n`)
}

async function makeDefaultExport(indexConf: IndexConfig, existingContent: string[]): Promise<string[]> {
	$out.debug('Making default export', indexConf.default.source)

	const conf = indexConf.default
	const contentImports: string[] = []
	let defaultExport: string

	$out.debug('Finding files matching source', {source: indexConf.default.source})

	const exportNames = []
	const files = Array.isArray(indexConf.default.source) ? await fg(indexConf.default.source, {ignore: makeIgnore(indexConf.default), onlyFiles: true}) : [indexConf.default.source]

	const singleDefault = indexConf.default?.type === 'default' && !Array.isArray(indexConf.default.source) ? indexConf.default.source : null

	$out.debug('Found files', files)

	for (const file of files) {
		const override = conf.overrides && objectFindKey(conf.overrides, key => picomatch(key)(file)) as string
		const export_type: DefaultFileExport = override ? conf.overrides[override] : conf.type
		const file_path = resolvePath(path.dirname(indexConf.output), file)
		const filename = path.basename(file, path.extname(file))
		let export_name = makeExportName(filename, conf.casing)

		if (singleDefault === file) {
			defaultExport = `export {default} from '${file_path}'`
		} else if (export_type === 'slug') {
			const dirname = path.dirname(file)
			export_name = safeVarName(slugify(path.join(dirname, filename)))
			contentImports.push(`import {* as ${export_name}} from '${file_path}'`)
		} else if (export_type === 'default') {
			contentImports.push(`import {default as ${export_name}} from '${file_path}'`)
		} else { // wildcard
			contentImports.push(`import * as ${export_name} from '${file_path}'`)
		}

		exportNames.push(export_name)
	}

	defaultExport ||= Array.isArray(indexConf.default.source)
		? `export default { ${exportNames.sort().join(', ')} }`
		: `export default ${exportNames.shift()}`

	const results = []

	if (contentImports.length) {
		results.push(...contentImports.sort(), '')
	}

	if (existingContent.length) {
		results.push(...existingContent, '')
	}

	results.push(defaultExport)

	return results
}

function makeIgnore(conf) {
	const ignore = [conf.output]

	if (conf.ignore) {
		ignore.push(...conf.ignore)
	}
	return ignore.filter(Boolean)
}

function makeExportName(name: string, casing: IndexerConfig['casing'] = 'keep'): string {
	switch (casing) {
		case 'camel': {
			return camelCase(name)
		}
		case 'pascal': {
			return name.charAt(0).toUpperCase() + camelCase(name.slice(1))
		}
		case 'snake': {
			return snakeCase(name)
		}
		case 'upper': {
			return name.toUpperCase()
		}
		case 'lower': {
			return name.toLowerCase()
		}
		default: { // case keep
			return safeVarName(name).replace(/_/g, '')
		}
	}
}

async function shouldIgnore(conf: IndexerConfig, file: string): Promise<boolean> {
	if (!fileExists(file)) {
		return true
	}

	if (isArray(conf.include) && conf.include.some(include => include && picomatch(include)(file))) {
		return false
	}

	if (isArray(conf.ignore) && conf.ignore.some(ignore => ignore && picomatch(ignore)(file))) {
		return true
	}

	if (getOutputs(conf).some(ignore => ignore && picomatch(ignore)(file)) || /\/index\.[a-z]+$/.test(file)) {
		return await getFirstLine(file) === indexer_banner
	}

	return file === conf.output
}

async function getFirstLine(pathToFile) {
	const readable = fs.createReadStream(pathToFile)
	const reader = readline.createInterface({input: readable})
	const line = await new Promise(resolve => {
		reader.once('line', line => {
			reader.close()
			resolve(line)
		})
	})
	readable.close()
	return line
}
