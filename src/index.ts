import {GenerateConfig} from './lib/config'
import {$out} from './common'
import {objectExcept} from '@snickbit/utilities'
import {generate} from './lib/generate'

export async function indexer(config?: GenerateConfig) {
	if (config) {
		if (config?.indexes) {
			const root: Omit<GenerateConfig, 'indexes'> = objectExcept<GenerateConfig>(config, ['indexes'])
			for (const key in config.indexes) {
				config.indexes[key] = await generate({...root, ...config.indexes[key]})
			}
		} else {
			config = await generate(config)
		}
	} else {
		$out.fatal('No configuration found and no source directory specified')
	}

	return config
}

export default indexer

export {default as indexerPlugin} from '@/plugin'
