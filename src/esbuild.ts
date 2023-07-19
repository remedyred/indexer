import {Plugin, PluginBuild} from 'esbuild'
import {getFileJSON} from '@snickbit/node-utilities'
import indexer from '@/index'

export default function esbuildIndexerPlugin(): Plugin {
	return {
		name: 'indexer',
		setup(build: PluginBuild) {
			build.onStart(async (): Promise<undefined> => {
				const {path: indexerPath} = await build.resolve('indexer.config.json')
				const indexerConfig = getFileJSON(indexerPath)

				// Pass the config object to the indexer
				await indexer(indexerConfig)
			})
		}
	}
}
