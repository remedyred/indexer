import {GenerateConfig} from './config'

let _outputs: string[]

export function getOutputs(indexerConfig: GenerateConfig): string[] {
	if (!_outputs) {
		const indexes = indexerConfig?.indexes || [indexerConfig]

		_outputs = indexes.filter(index => index?.output).map(index => index.output)
	}
	return _outputs
}
