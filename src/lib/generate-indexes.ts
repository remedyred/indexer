import {GenerateConfig, useConfig} from './config'
import {$out, $state, posix} from '../common'
import {arrayWrap, JSONPrettify} from '@snickbit/utilities'
import {ask} from '@snickbit/node-utilities'
import {useOutputs} from './use-outputs'
import {makeIgnore} from './make-ignore'
import {shouldIgnore} from './should-ignore'
import {makeExport} from './make-export'
import {saveIndex} from './save-index'
import fg from 'fast-glob'
import path from 'path'

export interface IndexerResults {
	message: string
	type: 'error' | 'success' | 'warn'
}

export async function generateIndexes(config?: GenerateConfig): Promise<GenerateConfig> {
	let conf: GenerateConfig = useConfig(config)
	const {dryRun, sources} = $state

	if (!conf) {
		const source = config.source ||
			sources && arrayWrap(sources)[0] ||
			await ask('Source glob pattern:', {initial: 'src/**/*.ts'})

		const output = config.output || await ask('Output file:', {initial: source.replace(/(\*+\/?)+/, 'index.ts')})

		const type = config.type || await ask('Export type:', {
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

		conf = {source, output, type}
	}

	useOutputs(config)

	if (!conf.source && !conf.indexes) {
		$out.verbose({conf})
		$out.fatal('Source glob pattern or indexes are required')
	}
	if (!conf.output) {
		$out.fatal('Output file is required')
	}
	conf.type ||= 'wildcard'

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
			indexes[dirname] ||= []

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
				if (!dryRun) {
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
		if (!dryRun) {
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
		if (dryRun) {
			$out.force.warn('DRY RUN : No changes have been made to the filesystem')
		}
		for (const result of results) {
			if ($out[result.type]) {
				$out[result.type](result.message)
			} else {
				$out.info(result.message)
			}
		}
	}

	return conf
}
