import {GenerateConfig} from './config'
import {camelCase, objectFindKey, safeVarName, spaceCase} from '@snickbit/utilities'
import {resolvePath} from './resolve-path'
import {makeExportName} from './make-export-name'
import picomatch from 'picomatch'
import path from 'path'

export function makeExport(conf: GenerateConfig, source: string, file: string) {
	const override = conf.overrides && objectFindKey(conf.overrides, key => picomatch(key)(file)) as string
	const export_type = override ? conf.overrides[override] : conf.type
	const file_path = resolvePath(source, file)
	const dirname = path.dirname(file).replace(source, '')
	const filename = path.basename(file_path, path.extname(file))

	if (export_type === 'slug') {
		const slug = safeVarName(camelCase(spaceCase(path.join(dirname, filename))))
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
