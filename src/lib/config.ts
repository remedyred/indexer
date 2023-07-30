import {$state, Args} from '@/common'
import {fileExists, getFileJSON} from '@snickbit/node-utilities'
import {lilconfig} from 'lilconfig'

export type FileExport = 'default' | 'group' | 'individual' | 'skip' | 'slug' | 'wildcard'
export type DefaultFileExport = 'default' | 'group' | 'slug'
export type WordCase = 'camel' | 'keep' | 'lower' | 'pascal' | 'snake' | 'upper'

/**
 * Shared config interface
 */
export interface CommonIndexConfig {
	source: string[] | string
	casing?: WordCase
	ignore?: string[]
	include?: string[]
}

/**
 * Special interface for Default Index
 */
export interface DefaultIndexConfig extends Omit<CommonIndexConfig, 'source'> {
	source?: string[] | string
	type: DefaultFileExport
	overrides?: {
		[key: string]: DefaultFileExport
	}
}

/**
 * Index config interface, used for all indexes except the default index
 */
export interface IndexConfig extends CommonIndexConfig {
	output: string
	type?: FileExport
	default?: DefaultIndexConfig
	overrides?: {
		[key: string]: FileExport
	}
}

/**
 * Root config interface for config file
 */
export interface GenerateConfig extends IndexConfig {
	recursive?: boolean
	indexes?: GenerateConfig[]
	noExit?: boolean
}

/**
 * Loads config from state
 * @param priority
 */
export function useConfig(priority?: GenerateConfig): GenerateConfig {
	if (priority) {
		return priority
	}

	if (!$state.config) {
		throw new Error('Config not loaded')
	}

	return $state.config
}

export async function setup(argv: Args) {
	$state.config = {
		source: argv.source || '',
		output: argv.output || ''
	}

	if ($state.config.source && !$state.config.source.includes('*')) {
		$state.config.source = `${$state.config.source}/**/*`
	}

	if (argv.config && argv.config !== 'false' && fileExists(argv.config)) {
		$state.configPath = argv.config
		const indexerConfig = getFileJSON(argv.config)
		$state.config = {...$state.config, ...indexerConfig}
	} else {
		const result = await lilconfig('indexer').search()
		if (result) {
			$state.configPath = result.filepath
			$state.config = {...$state.config, ...result.config}
		}
	}
}
