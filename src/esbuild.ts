import {Plugin, PluginBuild} from 'esbuild'
import {getFileJSON} from '@snickbit/node-utilities'
import {$out} from '@/common'
import fs from 'fs'
import indexer from '@/index'

export default function esbuildIndexerPlugin(): Plugin {
	return {
		name: 'indexer',
		setup(build: PluginBuild) {
			$out.prefix('IDX')
			build.onStart(async (): Promise<undefined> => {
				const {path: indexerPath} = await build.resolve('indexer.config.json', {kind: 'require-resolve', resolveDir: process.cwd()})
				if (indexerPath && fs.existsSync(indexerPath)) {
					const indexerConfig = getFileJSON(indexerPath)
					// Pass the config object to the indexer
					await indexer(indexerConfig)
				} else {
					$out.warn(`indexer.config.json not found at ${indexerPath}`)
				}
			})
		}
	}
}
