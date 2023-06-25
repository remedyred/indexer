import {GenerateConfig} from './config'
import {camelCase, objectFindKey, safeVarName, spaceCase} from '@snickbit/utilities'
import {resolvePath} from './resolve-path'
import {makeExportName} from './make-export-name'
import {$out} from '@/common'
import {Verbosity} from '@snickbit/out'
import picomatch from 'picomatch'
import path from 'path'

export async function makeExport(conf: GenerateConfig, source: string, file: string) {
	const override = conf.overrides && objectFindKey(conf.overrides, key => picomatch(key)(file)) as string
	const export_type = override && conf.overrides?.[override] ? conf.overrides[override] : conf.type
	const file_path = await resolvePath(source, file)
	const dirname = path.dirname(file).replace(source, '')
	let filename = path.basename(file_path, path.extname(file_path))
	if (filename.startsWith('index')) {
		filename = path.basename(path.dirname(file_path))
	}

	let debugData: any = {source, file, export_type}
	if (override) {
		debugData.override = override
	}
	if ($out.isVerbose(Verbosity.trace)) {
		debugData = {
			...debugData,
			file_path,
			dirname,
			filename
		}
	}
	$out.debug(debugData)

	if (export_type === 'slug') {
		const slug = safeVarName(camelCase(spaceCase(path.join(dirname, filename))))
		$out.debug({slug, file_path})
		return `export * as ${slug} from '${file_path}'`
	}
	const export_name = makeExportName(filename, conf.casing)

	switch (export_type) {
		case 'group': {
			$out.debug({export_type, export_name, file_path})
			return `export * as ${export_name} from '${file_path}'`
		}
		case 'individual':
		case 'wildcard': {
			$out.debug({export_type, file_path})
			return `export * from '${file_path}'`
		}
		default: {
			$out.debug({export_type, export_name, file_path})
			return `export {default as ${export_name}} from '${file_path}'`
		}
	}
}
