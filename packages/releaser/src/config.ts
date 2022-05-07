import {Out} from '@snickbit/out'
import {fileExists, getFileJson} from '@snickbit/node-utilities'
import os from 'os'
import {lilconfig} from 'lilconfig'
import path from 'path'
import {findPackages} from './packages'
import {Render} from './Render'
import {Argv, Bump, ReleaserConfig, ReleaserRun} from './definitions'
import {Queue} from '@snickbit/queue'
import {Release} from './Release'

const gitArgs = ['commitMessage', 'tagName', 'tagMessage']

const npmArgs = ['access', 'otp', 'registry']

const releaserArgs = ['force', 'dryRun', 'allowPrivate', 'config', 'bump']

export const releases: Record<string, Release> = {}

export const bumpTypes: Bump[] = ['patch', 'minor', 'major', 'prerelease', 'prepatch', 'preminor', 'premajor']

export const $queue = new Queue()

export const defaultConfig: ReleaserConfig = {
	workspaces: [],
	dependencies: true,
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
