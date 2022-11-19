import {useState} from './state'

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
	overrides?: Record<string, DefaultFileExport>
}

/**
 * Index config interface, used for all indexes except the default index
 */
export interface IndexConfig extends CommonIndexConfig {
	output: string
	type?: FileExport
	default?: DefaultIndexConfig
	overrides?: Record<string, FileExport>
}

/**
 * Root config interface for config file
 */
export interface IndexerConfig extends IndexConfig {
	recursive?: boolean
	indexes?: IndexerConfig[]
}

/**
 * Loads config from state
 * @param priority
 */
export function useConfig(priority?: IndexerConfig): IndexerConfig {
	return priority ?? useState().config
}
