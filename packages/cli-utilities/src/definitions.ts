import {PackageInfos} from 'workspace-tools'
import {Pkg} from './Pkg'

export interface PackageJson {
	name: string
	version: string
	scripts?: Record<string, string>

	[key: string]: any
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

export interface Argv extends GitConfig, NpmConfig {
	all: boolean
	dryRun: boolean
	config?: string
	force?: boolean
}

export interface AppConfig {
	workspaces: string[]
	force?: boolean
	dryRun?: boolean
	allowPrivate?: boolean
	conventionalCommits?: boolean
	config?: string
	rootPackage?: PackageJson
	git: GitConfig | false
	npm: NpmConfig | false
}

export interface AppRun {
	cwd: string
	packageInfos: PackageInfos
	packages: Pkg[]
	toposort?: string[]
	dependencyMap: Record<string, string[]>
}

export interface ShouldPublishResults {
	pass: boolean
	npm_version: string
	behindUpstream: number
	tests: any[]
}

export type ConfigTypes = Record<string, string[]>
