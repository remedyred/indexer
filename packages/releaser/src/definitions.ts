import {AppConfig, Argv as ArgvBase} from '@remedyred/cli-utilities'

export type Bump = 'major' | 'minor' | 'patch' | 'prerelease' | 'prepatch' | 'preminor' | 'premajor';

export interface BumpRecord {
	title: string
	type: Bump
	version?: string
}

export interface DependencyConfig {
	patch?: boolean | Bump
}

export interface ChangelogConfig {
	file: string
}

export interface Argv extends ArgvBase {
	bump: Bump
}

export interface ReleaserConfig extends AppConfig {
	conventionalCommits?: boolean
	bump?: Bump
	changelog?: ChangelogConfig | false
	dependencies?: DependencyConfig | boolean
}
