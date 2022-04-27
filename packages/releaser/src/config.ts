import {Out} from '@snickbit/out'
import {fileExists, getFileJson} from '@snickbit/node-utilities'
import os from 'os'

export interface PackageJson {
	name: string
	version: string
	scripts?: Record<string, string>
	dir?: string
	path?: string
	npm_version?: string
}

export interface ReleaserConfig {
	workspaces: string[]
	commitMessage: string
	tagName: string
	tagMessage: string
	access: string
	otp?: string
	force?: boolean
	bump?: 'major' | 'minor' | 'patch'
	dryRun?: boolean
	allowPrivate?: boolean
	config?: string
}

export interface Argv {
	bump: 'major' | 'minor' | 'patch'
	dryRun: boolean
	allowPrivate: boolean
	otp?: string
	access?: string
	config?: string
	force?: boolean
}

export type ReleaseName = string

export interface ReleaseConfig {
	name: ReleaseName
	bump: 'patch' | 'minor' | 'major' | number | boolean
	pkg: PackageJson
	version: string
	dryRun: boolean
	out: Out
	pushReady: boolean
	publishReady: boolean
	bumpReady: boolean
	branch?: string
	force?: boolean
}

export const defaultConfig: ReleaserConfig = {
	workspaces: [],
	commitMessage: 'chore(release): publish',
	tagName: '${name}@${version}',
	tagMessage: '${name} ${version}',
	access: 'public'
}

let config: ReleaserConfig

export type Releases = Record<ReleaseName, ReleaseConfig>

export const releases: Releases = {}

export const $out = new Out('releaser')

export const maxProcesses = os.cpus().length - 1
export const processes = []
export const awaitProcesses = async () => await Promise.all(processes.splice(0))

export async function getConfig(argv?: Argv) {
	if (config) return config

	let conf: any
	if (argv?.config && fileExists(argv.config)) {
		conf = getFileJson(argv.config)
	}

	if (!conf && fileExists('releaser.config.json')) {
		conf = getFileJson('releaser.config.json')
	}

	if ((!conf || !conf.workspaces) && fileExists('package.json')) {
		let packageConfig = getFileJson('package.json')
		if (packageConfig?.releaser?.workspaces) {
			packageConfig = packageConfig.releaser
		}

		if (!conf) {
			conf = packageConfig
		} else if (!conf.workspaces) {
			conf.workspaces = packageConfig.workspaces
		}
	}

	if (conf?.workspaces) {
		config = Object.assign(defaultConfig, conf, (argv || {})) as ReleaserConfig
		return config
	}

	$out.fatal('No workspaces defined')
}
