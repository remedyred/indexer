import {Out} from '@snickbit/out'
import {fileExists, getFileJson} from '@snickbit/node-utilities'
import os from 'os'
import {lilconfig} from 'lilconfig'
import path from 'path'
import {PackageInfos} from 'workspace-tools'
import {Pkg} from './Pkg'
import {findPackages} from './packages'
import {Render} from './Render'

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
	autoCommitFiles?: string[]
	tag: boolean
	tagName?: string
	tagMessage?: string
	push: boolean
	branch?: string
	remote?: string
}

export interface ReleaserChangelogConfig {
	file: string
}

const npmArgs = ['access', 'otp', 'registry']

export interface ReleaserNpmConfig {
	publish: boolean
	access?: string
	otp?: string
	registry?: string
	client?: string
}

const releaserArgs = ['force', 'dryRun', 'allowPrivate', 'config', 'bump']

export interface ReleaserConfig {
	workspaces: string[]
	force?: boolean
	dryRun?: boolean
	allowPrivate?: boolean
	config?: string
	rootPackage?: PackageJson
	bump?: 'major' | 'minor' | 'patch' | 'prerelease'
	git: ReleaserGitConfig | false
	npm: ReleaserNpmConfig | false
	changelog: ReleaserChangelogConfig | false
}

export interface ReleaserRun {
	cwd: string
	packageInfos: PackageInfos
	packages: Pkg[]
	toposort?: string[]
	dependencyMap: Record<string, string[]>
	pushedRepos: Set<string>
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
		autoCommitFiles: [],
		tag: true,
		tagName: '${name}@${version}',
		tagMessage: '${name} ${version}',
		remote: 'origin',
		push: true
	},
	npm: {
		access: 'public',
		publish: true
	},
	changelog: {
		file: 'CHANGELOG.md'
	}
}

let config: ReleaserConfig


export const $run: ReleaserRun = {
	cwd: process.cwd(),
	packageInfos: {},
	packages: [],
	dependencyMap: {},
	pushedRepos: new Set<string>()
}

export const $out = new Out('releaser')

export const $render = new Render()

export const maxProcesses = os.cpus().length - 1
export const processes = []
export const awaitProcesses = async () => await Promise.all(processes.splice(0))

export async function getConfig(argv?: Argv) {
	if (config) return config

	let conf: any
	if (argv?.config && fileExists(argv.config)) {
		conf = getFileJson(argv.config)
		$run.cwd = path.dirname(argv.config)
	} else {
		const result = await lilconfig('releaser').search()
		conf = result.config
		$run.cwd = path.dirname(result.filepath)
	}

	if (fileExists('package.json')) {
		let packageConfig = getFileJson('package.json')

		if ((!conf || !conf.workspaces)) {
			$run.cwd = process.cwd()
			if (packageConfig?.releaser?.workspaces) {
				packageConfig = packageConfig.releaser
			} else if (packageConfig.workspaces) {
				if (!conf) {
					conf = {workspaces: packageConfig.workspaces}
				} else if (!conf.workspaces) {
					conf.workspaces = packageConfig.workspaces
				}
			} else {
				$out.fatal('No workspaces found, no releaser config found.')
			}
		}

		conf.rootPackage = packageConfig
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

		$run.packages = await findPackages()

		return config
	}

	$out.fatal('No workspaces defined')
}
