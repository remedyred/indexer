import {DefaultFileExport, DefaultIndexConfig, IndexConfig} from './config'
import {$out} from '@/common'
import {makeIgnore} from './make-ignore'
import {objectFindKey, safeVarName, slugify} from '@snickbit/utilities'
import {resolvePath} from './resolve-path'
import {makeExportName} from './make-export-name'
import fg from 'fast-glob'
import picomatch from 'picomatch'
import path from 'path'

/**
 * Make default export
 */
export async function makeDefaultExport(indexConf: IndexConfig, existingContent: string[]): Promise<string[]> {
	$out.debug('Making default export', indexConf.default?.source)

	const conf = indexConf.default || {} as DefaultIndexConfig
	const contentImports: string[] = []
	let defaultExport: string

	$out.debug('Finding files matching source', {source: conf.source})

	const exportNames: string[] = []
	let commonSource = ''
	let files: string[] = []
	let singleDefault = ''
	if (Array.isArray(conf.source)) {
		// sorted from longest to shortest
		for (const source of conf.source.sort()) {
			const cleanSource = source
				.replaceAll('\\', '/')
				.replaceAll(/([/\\]\*{1,2})+/g, '')
			if (!commonSource || commonSource.startsWith(cleanSource)) {
				commonSource = cleanSource
			}
		}

		files = await fg(conf.source, {
			ignore: makeIgnore(indexConf.default),
			onlyFiles: true
		})
	} else if (conf.source) {
		files = [conf.source]

		if (indexConf.default?.type === 'default') {
			singleDefault = conf.source
		}
	}

	$out.debug('Found files', files)

	for (const file of files) {
		const override = conf.overrides && objectFindKey(conf.overrides, key => picomatch(key)(file)) as string
		const export_type: DefaultFileExport = override && conf.overrides?.[override] ? conf.overrides[override] : conf.type
		const file_path = await resolvePath(path.dirname(indexConf.output), file)
		const filename = path.basename(file, path.extname(file))
		let export_name = makeExportName(filename, conf.casing)

		if (singleDefault === file) {
			defaultExport = `export {default} from '${file_path}'`
		} else if (export_type === 'slug') {
			const dirname = path.dirname(file)
				.replace(commonSource, '')
			export_name = safeVarName(slugify(path.join(dirname, filename)))
			contentImports.push(`import {* as ${export_name}} from '${file_path}'`)
		} else if (export_type === 'default') {
			contentImports.push(`import {default as ${export_name}} from '${file_path}'`)
		} else { // wildcard
			contentImports.push(`import * as ${export_name} from '${file_path}'`)
		}

		exportNames.push(export_name)
	}

	defaultExport ||= Array.isArray(conf.source)
		? `export default { ${exportNames.sort().join(', ')} }`
		: `export default ${exportNames.shift()}`

	const results: string[] = []

	if (contentImports.length) {
		results.push(...contentImports.sort(), '')
	}

	if (existingContent.length) {
		results.push(...existingContent, '')
	}

	results.push(defaultExport)

	return results
}
