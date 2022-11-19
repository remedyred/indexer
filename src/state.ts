import {Args} from './common'
import {fileExists, getFileJson} from '@snickbit/node-utilities'
import {lilconfig} from 'lilconfig'
import {IndexerConfig} from './config'
import {createStore} from '@snickbit/state'

export interface State {
	changed_files: string[]
	config?: IndexerConfig
	args: Args
	configPath: string
	sources: string[]
	outputs: string[]
	dryRun: boolean
	watch: boolean
	rootOnly: boolean
}

export const useState = createStore<Partial<State>>({changed_files: []})

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
