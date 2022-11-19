import {$out, Args} from './common'
import {arrayWrap} from '@snickbit/utilities'
import {fileExists, getFileJson} from '@snickbit/node-utilities'
import {lilconfig} from 'lilconfig'
import {GenerateConfig} from './config'
import {createStore} from '@snickbit/state'

export interface State {
	changed_files: string[]
	config?: GenerateConfig
	args: Args
	configPath: string
	sources: string[]
	outputs: string[]
	dryRun: boolean
	watch: boolean
	rootOnly: boolean
}

export const useState = createStore<Partial<State>>({changed_files: []})

export function useSources(): string[] {
	const $state = useState()
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

export async function setup(argv: Args) {
	const $state = useState()
	$state.config = {
		source: argv.source,
		output: argv.output
	}

	if ($state.config.source && !$state.config.source.includes('*')) {
		$state.config.source = `${$state.config.source}/**/*`
	}

	if (argv.config && argv.config !== 'false' && fileExists(argv.config)) {
		$state.configPath = argv.config
		const indexerConfig = getFileJson(argv.config)
		$state.config = {...$state.config, ...indexerConfig}
	} else {
		const result = await lilconfig('indexer').search()
		if (result) {
			$state.configPath = result.filepath
			$state.config = {...$state.config, ...result.config}
		}
	}
}
