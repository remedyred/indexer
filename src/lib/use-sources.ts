import {$out, $state} from '../common'
import {arrayWrap} from '@snickbit/utilities'

export function useSources(): string[] {
	if (!$state.sources) {
		const sources: string[] = []
		const config = $state.config
		$out.info('Loading sources...', {config})
		if (config.source) {
			sources.push(...arrayWrap(config.source))
		}

		if (config?.indexes) {
			for (const key in config.indexes) {
				const index = config.indexes[key]
				if (index.source) {
					sources.push(...arrayWrap(index.source))
				}
			}
		}

		$state.sources = sources
	}

	return $state.sources
}
