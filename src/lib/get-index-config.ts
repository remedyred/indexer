import {GenerateConfig, useConfig} from './config'
import {arrayWrap} from '@snickbit/utilities'
import picomatch from 'picomatch'

/**
 * Get index config that matches a file
 * @param file
 */
export function getIndexConfig(file: string): GenerateConfig {
	const config = useConfig()

	if (config.source && picomatch(config.source)(file)) {
		return config
	}

	if (config.indexes) {
		for (const index of config.indexes) {
			const sources = arrayWrap(index.source)
			for (const source of sources) {
				if (picomatch(source)(file)) {
					return index
				}
			}
		}
	}
}
