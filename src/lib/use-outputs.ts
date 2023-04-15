import {GenerateConfig} from './config'
import {$state} from '../common'

export function useOutputs(indexerConfig: GenerateConfig): string[] {
	if (!$state.outputs) {
		const indexes = indexerConfig?.indexes || [indexerConfig]

		$state.outputs = indexes.filter(index => index?.output).map(index => index.output)
	}
	return $state.outputs
}
