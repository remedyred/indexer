import {Out} from '@snickbit/out'
import {$run as $superRun, AppRun as AppRunBase, getConfig, setConfigTypes} from '@remedyred/cli-utilities'
import {Argv, Bump, ReleaserConfig} from './definitions'
import {Queue} from '@snickbit/queue'
import {Release} from './Release'

export interface AppRun extends AppRunBase {
	pushedRepos?: Set<string>
}

export const releases: Record<string, Release> = {}

export const bumpTypes: Bump[] = [
	'patch',
	'minor',
	'major',
	'prerelease',
	'prepatch',
	'preminor',
	'premajor'
]

export const $queue = new Queue()

export const defaultConfig: ReleaserConfig = {
	workspaces: [],
	dependencies: true,
	conventionalCommits: false,
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
	changelog: {file: 'CHANGELOG.md'}
}

let config: Argv & ReleaserConfig

export const $run = $superRun as AppRun
$run.pushedRepos = new Set<string>()

export const $out = new Out('releaser')

setConfigTypes({app: ['bump']})

export async function useConfig(argv?: Argv): Promise<Argv & ReleaserConfig> {
	if (config) {
		return config
	}
	config = await getConfig<ReleaserConfig, Argv>('releaser', defaultConfig, argv)
	return config
}
