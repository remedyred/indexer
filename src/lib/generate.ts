import {GenerateConfig} from './config'
import {$state} from '@/common'
import {generateIndexes} from './generate-indexes'

export async function generate(config: GenerateConfig): Promise<GenerateConfig> {
	$state.isGenerating = true
	const results = await generateIndexes(config)
	$state.isGenerating = false
	return results
}
