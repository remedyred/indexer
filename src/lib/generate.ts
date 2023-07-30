import {GenerateConfig} from './config'
import {$out, $state} from '@/common'
import {generateIndexes} from './generate-indexes'

export async function generate(config: GenerateConfig): Promise<GenerateConfig> {
	$out.before(() => {
		if (config.noExit && $out.state.exit) {
			$out.state.throw = !!$out.state.exit
			$out.state.exit = false
		}
	})

	$state.isGenerating = true
	const results = await generateIndexes(config)
	$state.isGenerating = false
	return results
}
