import {Out} from '@snickbit/out'
import {fileExists, getFileJson} from '@snickbit/node-utilities'
import os from 'os'
import {Model} from '@snickbit/model'
import {Release} from './release'

export interface PackageJson {
	name: string
	version: string
	scripts?: Record<string, string>

	[key: string]: any
}

const gitArgs = ['commitMessage', 'tagName', 'tagMessage']

export interface ReleaserGitConfig {
	commit: boolean
	commitMessage?: string
	tag: boolean
	tagName?: string
	tagMessage?: string
	push: boolean
	branch?: string
	remote?: string
}

const npmArgs = ['access', 'otp', 'registry']

export interface ReleaserNpmConfig {
	publish: boolean
	access?: string
	otp?: string
	registry?: string
}

const releaserArgs = ['force', 'dryRun', 'allowPrivate', 'config', 'bump']

export interface ReleaserConfig {
	workspaces: string[]
	force?: boolean
	dryRun?: boolean
	allowPrivate?: boolean
	config?: string
	bump?: 'major' | 'minor' | 'patch' | 'prerelease'
	git: ReleaserGitConfig | boolean
	npm: ReleaserNpmConfig | boolean
}

export interface Argv extends ReleaserGitConfig, ReleaserNpmConfig {
	bump: 'major' | 'minor' | 'patch' | 'prerelease'
	dryRun: boolean
	config?: string
	force?: boolean
}


export const defaultConfig: ReleaserConfig = {
	workspaces: [],
	git: {
		commit: true,
		commitMessage: 'chore(release): publish',
		tag: true,
		tagName: '${name}@${version}',
		tagMessage: '${name} ${version}',
		remote: 'origin',
		push: true
	},
	npm: {
		access: 'public',
		publish: true
	}
}

let config: ReleaserConfig

export const releases: Release[] = []

export const $out = new Out('releaser')

export const cache = new Model()

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
		config = Object.assign(defaultConfig, conf) as ReleaserConfig


		for (const gitArg of gitArgs) {
			if (argv?.[gitArg]) {
				config.git[gitArg] = argv[gitArg]
			}
		}

		for (const npmArg of npmArgs) {
			if (argv?.[npmArg]) {
				config.npm[npmArg] = argv[npmArg]
			}
		}

		for (const releaserArg of releaserArgs) {
			if (argv?.[releaserArg]) {
				config[releaserArg] = argv[releaserArg]
			}
		}

		return config
	}

	$out.fatal('No workspaces defined')
}
