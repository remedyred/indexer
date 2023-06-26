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
	let export_string = `// No export for ${file_path}`
	const export_name = export_type === 'slug'
		? safeVarName(camelCase(spaceCase(path.join(dirname, filename))))
		: makeExportName(filename, conf.casing)

	switch (export_type) {
		case 'slug':
		case 'group': {
			export_string = `export * as ${export_name} from '${file_path}'`
			break
		}
		case 'individual': {
			export_string = `export * from '${file_path}'`
			break
		}
		default: {
			export_string = `export {default as ${export_name}} from '${file_path}'`
			break
		}
	}

	let debugData: any = {
		source,
		file,
		export_string,
		override
	}
	if ($out.isVerbose(Verbosity.trace)) {
		debugData = {
			...debugData,
			export_name,
			export_type,
			file_path,
			dirname,
			filename
		}
	}

	$out.debug(debugData)

	return export_string
}
