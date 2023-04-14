import {Out} from '@snickbit/out'
import {GenerateConfig} from './lib/config'
import path from 'path'

export const DEFAULT_CONFIG_NAME = 'indexer.config.json'

export const posix = path.posix

export const indexer_banner = '// WARNING: This file is automatically generated. Any changes will be lost the next time the generator is run.'

export const $out = new Out('indexer')

export interface Args {
	source?: string
	output?: string
	dryRun?: boolean
	config?: string
	watch?: boolean
}

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

export const $state = {} as State
