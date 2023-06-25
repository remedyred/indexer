import {GenerateConfig} from './config'
import {$state} from '@/common'

export function useOutputs(indexerConfig?: GenerateConfig): string[] {
	if (!$state.outputs) {
		const indexes = indexerConfig?.indexes || [indexerConfig]

		$state.outputs = indexes
			.filter<GenerateConfig>((index): index is GenerateConfig => !!(index && index?.output))
			.map<string>(index => index?.output)
	}
	return $state.outputs
}
