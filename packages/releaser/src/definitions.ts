import {PackageInfos} from 'workspace-tools'
import {Pkg} from './Pkg'

export type Bump = 'major' | 'minor' | 'patch' | 'prerelease' | 'prepatch' | 'preminor' | 'premajor';

export interface PackageJson {
	name: string
	version: string
	scripts?: Record<string, string>

	[key: string]: any
}

export interface BumpRecord {
	title: string
	type: Bump
	version?: string
}

export interface DependencyConfig {
	patch?: boolean | Bump
}

export interface GitConfig {
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

export interface NpmConfig {
	publish: boolean
	access?: string
	otp?: string
	registry?: string
	client?: string
}

export interface ChangelogConfig {
	file: string
}

export interface Argv extends GitConfig, NpmConfig {
	bump: Bump
	dryRun: boolean
	config?: string
	force?: boolean
}

export interface ReleaserConfig {
	workspaces: string[]
	force?: boolean
	dryRun?: boolean
	allowPrivate?: boolean
	conventionalCommits?: boolean
	config?: string
	rootPackage?: PackageJson
	bump?: Bump
	git: GitConfig | false
	npm: NpmConfig | false
	changelog: ChangelogConfig | false
	dependencies: DependencyConfig | boolean
}

export interface ReleaserRun {
	cwd: string
	packageInfos: PackageInfos
	packages: Pkg[]
	toposort?: string[]
	dependencyMap: Record<string, string[]>
	pushedRepos: Set<string>
}
