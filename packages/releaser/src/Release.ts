import {execa, execaCommand} from 'execa'
import {$render, $run, getConfig} from './config'
import {gitAdd, gitBehindUpstream, gitBranch, gitCommit, gitLog, gitPush, gitRepoPath, gitTag, gitUrl, isGitClean} from './git'
import {Pkg} from './Pkg'
import {interpolate, isArray, isEmpty, sleep} from '@snickbit/utilities'
import {fileExists, getFile, saveFile, saveFileJson} from '@snickbit/node-utilities'
import path from 'path'
import upwords from '@snickbit/upwords'
import {Renderer} from './Render'
import {Bump, ReleaserConfig} from './definitions'
import {addRelease, isDependent} from './run'
import {Out} from '@snickbit/out'

export interface ShouldPublishResults {
	pass: boolean
	npm_version: string
	behindUpstream: number
	tests: any[]
}

export type ReleaseName = string

export type ReleaseStage = 'bump' | 'changelog' | 'save' | 'commit' | 'push' | 'publish'

export interface Release {
	[key: string | symbol]: any
}

export class Release {
	private _config: ReleaserConfig
	protected proxy: Release
	pkg: Pkg
	version?: string
	bumpType?: Bump
	stage: ReleaseStage
	publishReady = false
	bumpReady = false
	branch = 'main'
	repoPath: string

	commitMessage?: string
	tagMessage?: string
	tagName?: string
	lastTagName?: string

	changelogContent?: string
	changelogPath?: string

	out: Renderer | Out

	constructor(pkg: Pkg, bump: Bump, version: string) {
		this.pkg = pkg
		this.bumpType = bump
		this.version = version
		this.publishReady = this.pkg.npm_version === this.pkg.version
		this.stage = 'bump'

		this.out = $render.add(pkg.name)
		// this.out = new Out(pkg.name)

		this.proxy = new Proxy(this, {
			get: (target: Release, prop: string, receiver?: any): any => {
				if (prop in target) {
					return target[prop]
				}

				if (prop in target.pkg) {
					return target.pkg[prop]
				}

				return Reflect.get(target, prop, receiver)
			},
			set: (target: Release, prop: string, value?: any): any => {
				if (prop in target) {
					target[prop] = value
					return true
				}

				if (prop in target.pkg) {
					target.pkg[prop] = value
					return true
				}

				return Reflect.set(target, prop, value)
			}
		})

		return this.proxy
	}

	get name(): string {
		return this.pkg.name
	}

	get dependencies(): string[] {
		const dependencies = Object.keys(this.pkg.dependencies) || []
		const devDependencies = Object.keys(this.pkg.devDependencies) || []
		return [...dependencies, ...devDependencies]
	}

	async getConfig() {
		if (!this._config) {
			this._config = await getConfig()

			if ('releaser' in this.pkg) {
				this._config = {...this._config, ...this.pkg.releaser}
			}
		}
		return this._config
	}

	async getBranch() {
		if (!this.branch) {
			this.branch = await gitBranch(this.dir)
		}
		return this.branch
	}

	async getRepoPath() {
		if (!this.repoPath) {
			this.repoPath = await gitRepoPath(this.dir)
		}
		return this.repoPath
	}

	async getGitMessages() {
		const config = await this.getConfig()
		if (config.git) {
			const gitConfig = config.git
			this.commitMessage = interpolate(gitConfig.commitMessage, {name: this.name, version: this.version})
			this.tagMessage = interpolate(gitConfig.tagMessage, {name: this.name, version: this.version})
			this.tagName = interpolate(gitConfig.tagName, {name: this.name, version: this.version})
			this.lastTagName = interpolate(gitConfig.tagName, {name: this.name, version: this.pkg.npm_version})
		}
	}

	async bump() {
		const config = await this.getConfig()
		await isDependent(this.name)

		this.out.log('Checking working tree')
		const status = await isGitClean(this.dir)
		if (status.length) {
			this.out.error(`Working tree is dirty, skipping release for {cyan} ${this.name}{/cyan}`)
			return
		}

		if (this.scripts?.prerelease) {
			this.out.log(`Running prerelease script`)
			if (config.dryRun) {
				this.out.warn(`DRY RUN: ${this.scripts.prerelease}`)
			} else {
				await execaCommand(this.scripts.prerelease, {cwd: this.dir})
			}
		}

		if (!this.version) {
			this.out.error(`No version specified, skipping release for {cyan} ${this.name}{/cyan}`)
			return
		}

		this.out.log(`Bumping version to {magenta}${this.version}{/magenta}`)
		this.pkg.version = this.version

		this.out.log('Checking for dependencies')
		if (this.name in $run.dependencyMap && !isEmpty($run.dependencyMap[this.name])) {
			for (let pkg of Object.values($run.packageInfos)) {
				if (!pkg || pkg.name === this.name) continue
				if (pkg.dependencies && this.name in pkg.dependencies) {
					pkg.dependencies[this.name] = `^${this.version}`
					addRelease(pkg.name, 'patch', true)
					this.out.log(`Bumped ${this.name} to ${this.version} in ${pkg.name} dependencies`)
				}
				if (pkg.devDependencies && this.name in pkg.devDependencies) {
					pkg.devDependencies[this.name] = `^${this.version}`
					addRelease(pkg.name, 'patch', true)
					this.out.log(`Bumped ${this.name} to ${this.version} in ${pkg.name} devDependencies`)
				}
			}
		}

		this.stage = 'changelog'
		this.out.success(`Bumped version to {cyan}${this.version}{/cyan}`)
	}

	async changelog() {
		const config = await this.getConfig()

		await this.getGitMessages()

		if (config.changelog) {
			const changelogConfig = config.changelog

			this.out.log(`Generating changelog`)

			const repoPath = await this.getRepoPath()
			const repoUrl = await gitUrl(this.pkg.dir)
			const gitRelativePath = path.relative(repoPath, this.pkg.dir).replace(/\\/g, '/')
			const results = await gitLog(repoPath, this.lastTagName, gitRelativePath)

			if (results.trim().length) {
				let changelog = `## ${this.version}\n\n`

				if (this.bumpType) {
					changelog += `### ${upwords(this.bumpType)} Changes\n\n`
				}

				const parsedCommits = results.matchAll(/^"\* (?:(?<type>[a-z]+)(?:\((?<scope>.*?)\))?: )?(?<description>[\w\W\s\n]*?)\s+\((?<commit>[a-z\d]{7})\)"$/gm)

				for (let parsedCommit of parsedCommits) {
					let {type, scope, description, commit} = parsedCommit.groups
					const commitLink = repoUrl ? `[${commit}](${repoUrl.replace(/\.git$/, '')}/commit/${commit})` : commit
					const commitType = type ? ` **${type}**${scope ? `(${scope})` : ''}: ` : ''

					changelog += `- ${commitLink}${commitType} ${description}\n`
				}

				this.changelogPath = path.join(this.pkg.dir, changelogConfig.file)

				let header = ''
				let body = ''
				if (fileExists(this.changelogPath)) {
					const logLines = getFile(this.changelogPath).split('\n')
					let headerLines
					for (headerLines = 0; headerLines < logLines.length; headerLines++) {
						if (logLines[headerLines].match(/^\s*$/)) {
							break
						}
					}
					header = logLines.splice(0, headerLines).join('\n')
					body = logLines.join('\n')
				}

				if (!header.trim()) {
					header += `# ${this.name} Changelog`
				}

				this.changelogContent = `${header}\n\n${changelog}\n${body}`
			} else {
				this.out.warn('No git log found, skipping changelog')
			}
		} else {
			this.out.warn('No changelog config found, skipping changelog')
			return
		}

		this.stage = 'save'
		this.out.success('Changelog generated')
	}

	async save() {
		const config = await this.getConfig()

		this.out.log('Saving package.json')
		if (config.dryRun) {
			this.out.warn(`DRY RUN: saving package.json to ${this.pkg.path}`)
			await sleep(300)
		} else {
			saveFileJson(this.pkg.path, this.pkg.toJSON())
		}
		if (this.changelogPath && this.changelogContent) {
			this.out.log('Saving changelog')
			if (config.dryRun) {
				this.out.warn(`DRY RUN: Saving changelog to ${this.changelogPath}`)
				await sleep(300)
			} else {
				saveFile(this.changelogPath, this.changelogContent)
			}
		}

		if (this.changelogPath && this.changelogContent) {
			this.out.log('Saving changelog')
			if (config.dryRun) {
				this.out.warn(`DRY RUN: Saving changelog to ${this.changelogPath}`)
				await sleep(300)
			} else {
				saveFile(this.changelogPath, this.changelogContent)
			}
		}

		this.stage = 'commit'
		this.out.success('Saved files')
	}

	async commit() {
		const config = await this.getConfig()

		if (config.git) {
			const gitConfig = config.git
			await this.getGitMessages()

			this.out.log('Adding changes')

			const paths = [this.pkg.path]

			if (config.changelog) {
				const changelogConfig = config.changelog
				const changeLogPath = path.join(this.pkg.dir, changelogConfig.file)
				if (fileExists(changeLogPath)) {
					paths.push(changeLogPath)
				}
			}

			if (isArray(gitConfig.autoCommitFiles)) {
				paths.push(...gitConfig.autoCommitFiles)
			}

			if (config.dryRun) {
				this.out.warn(`DRY RUN: git add ${paths.join(' ')}`)
			} else {
				await gitAdd(this.dir, ...paths)
			}

			this.out.log('Committing changes')

			if (config.dryRun) {
				this.out.warn(`DRY RUN: git commit --message "${this.commitMessage}"`)
			} else {
				await gitCommit(this.dir, this.commitMessage)
			}

			this.out.log('Tagging release')

			if (config.dryRun) {
				this.out.warn(`DRY RUN: git tag --annotate --message="${this.tagMessage}" ${this.tagName}`)
			} else {
				await gitTag(this.dir, this.tagName, this.tagMessage)
			}

			this.out.log('Marking to be pushed and published')
		} else {
			this.out.warn('No git config found, skipping commit')
			return
		}

		this.stage = 'push'
		this.out.success('Committed changes')
	}

	async push() {
		const repoPath = await this.getRepoPath()
		if ($run.pushedRepos.has(repoPath)) {
			this.out.log(`skipping already pushed repo: ${repoPath}`)
		} else {
			const config = await this.getConfig()
			const branch = await this.getBranch()

			this.out.log('Pushing changes')
			if (config.dryRun) {
				this.out.warn(`DRY RUN: git push`)
			} else {
				const status = await gitBehindUpstream(this.dir, branch)
				if (!status.length) {
					this.out.log('Nothing to push, skipping')
				} else {
					await gitPush(this.dir, branch)
					$run.pushedRepos.add(repoPath)
					this.publishReady = true
				}
			}
		}

		this.publishReady = true
		this.stage = 'publish'
		this.out.success('Pushed changes')
	}

	async publish() {
		const config = await this.getConfig()

		if (config.npm && config.npm?.publish && this.version !== this.pkg.npm_version) {
			const npmConfig = config.npm

			if (this.scripts?.prepublish) {
				this.out.log(`Running prepublish script`)

				if (config.dryRun) {
					this.out.warn(`DRY RUN: ${this.scripts.prepublish}`)
				} else {
					await execaCommand(this.scripts.prepublish, {cwd: this.dir})
				}
			}

			this.out.log('Publishing package')

			const npmPublishArgs = [
				'publish',
				'--ignore-scripts',
				`--access=${npmConfig.access || 'public'}`
			]

			if (config.dryRun) {
				npmPublishArgs.push('--dry-run')
			}

			if (npmConfig.otp) {
				npmPublishArgs.push(`--otp=${npmConfig.otp}`)
			}

			if (npmConfig.registry) {
				npmPublishArgs.push(`--registry=${npmConfig.registry}`)
			}

			try {
				const results = await execa('npm', npmPublishArgs, {cwd: this.dir})
				this.out.log(results.stdout)
			} catch (e) {
				this.out.error('Publishing errored: ' + e.message)
				return
			}

			if (this.scripts?.postpublish) {
				this.out.log(`Running postpublish script`)
				if (config.dryRun) {
					this.out.warn(`DRY RUN: ${this.scripts.postpublish}`)
				} else {
					await execaCommand(this.scripts.postpublish, {cwd: this.dir})
				}
			}
			this.out.success('Published package')
		} else {
			this.out.warn('Publishing skipped')
		}
	}
}



