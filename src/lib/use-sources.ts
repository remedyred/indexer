import {$out, $state} from '../common'
import {arrayWrap} from '@snickbit/utilities'

export function useSources(): string[] {
	if (!$state.sources) {
		const sources: string[] = []
		const config = $state.config
		$out.verbose('Loading sources...', {$state})
		if (config.source) {
			sources.push(...arrayWrap(config.source))
		}

		if (config?.indexes) {
			for (const index of config.indexes) {
				if (index.source) {
					sources.push(...arrayWrap(index.source))
				}
			}
		}

		$state.sources = sources
	}

	return $state.sources
}
