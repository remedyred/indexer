import {useSources} from './lib/use-sources'
import {useOutputs} from './lib/use-outputs'
import {$out, $state} from './common'
import {debounceAsync} from '@snickbit/utilities'
import {generate} from './lib/generate'
import {getIndexConfig} from './lib/get-index-config'
import chokidar from 'chokidar'

export async function watch() {
	const sources = useSources()
	const outputs = useOutputs($state.config)

	const debouncedGenerateIndexes = debounceAsync(generate, 200)
	let fileChanged = true

	chokidar
		.watch(sources, {persistent: true, ignored: outputs})
		.on('change', async file => {
			fileChanged = true
			$out.debug(`${file} changed`)
			const indexConfig = getIndexConfig(file)
			$out.verbose('Using index config:', indexConfig)
			if (indexConfig) {
				await debouncedGenerateIndexes(indexConfig)
			}
		}).on('ready', () => {
			if (!$state.isGenerating && fileChanged) {
				$out.info(`Waiting for file changes...`)
				fileChanged = false
			}
		}).on('all', (event, path) => {
			$out.label(event).verbose(path)
		})
}
