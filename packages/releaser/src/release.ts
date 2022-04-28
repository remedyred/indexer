import {execa, execaCommand} from 'execa'
import {$out, cache, getConfig, ReleaserConfig} from './config'
import {gitAdd, gitBehindUpstream, gitBranch, gitCommit, gitLog, gitPush, gitRepoPath, gitTag, isGitClean} from './git'
import {Out} from '@snickbit/out'
import {Pkg} from './pkg'
import {interpolate} from '@snickbit/utilities'
import {fileExists, getFile, saveFile, saveFileJson} from '@snickbit/node-utilities'
import path from 'path'
import upwords from '@snickbit/upwords'

export interface ShouldPublishResults {
	results: boolean
	npm_version: string
	behindUpstream: string
}

export type ReleaseName = string

export type ReleaseStage = 'bump' | 'changelog' | 'commit' | 'push' | 'publish'

export interface Release {
	[key: string | symbol]: any
}

export class Release {
	private _config: ReleaserConfig
	protected proxy: Release
	pkg: Pkg
	version?: string
	bumpType?: string
	out: Out
	stage: ReleaseStage
	publishReady = false
	bumpReady = false
	branch = 'main'
	repoPath: string

	commitMessage?: string
	tagMessage?: string
	tagName?: string
	lastTagName?: string

	constructor(pkg: Pkg, bump: string, version: string) {
		this.pkg = pkg
		this.out = new Out(this.pkg.name)
		this.bumpType = bump
		this.version = version
		this.publishReady = this.pkg.npm_version === this.pkg.version
		this.stage = 'bump'

		this.proxy = new Proxy(this, {
			get(target: Release, prop: string, receiver?: any): any {
				if (prop in target) {
					return target[prop]
				}

				if (prop in target.pkg) {
					return target.pkg[prop]
				}

				return Reflect.get(target, prop, receiver)
			},
			set: function (target: Release, prop: string, value?: any) {
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

	async getConfig() {
		if (!this._config) {
			this._config = await getConfig()
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

		this.out.debug('Checking working tree')
		const status = await isGitClean(this.dir)
		if (status.length) {
			this.out.force.error(`Working tree is dirty, skipping release for {cyan}${this.name}{/cyan}`)
			this.out.force.broken.error(...status.split('\n'))
			return
		}

		if (this.scripts?.prerelease) {
			this.out.info(`Running prerelease script`)
			if (config.dryRun) {
				this.out.force.warn(`DRY RUN: ${this.scripts.prerelease}`)
			} else {
				await execaCommand(this.scripts.prerelease, {cwd: this.dir})
			}
		}

		this.out.info(`Bumping version to {magenta}${this.version}{/magenta}`)
		this.pkg.version = this.version
		if (config.dryRun) {
			this.out.force.warn(`DRY RUN: bumping ${this.pkg.name}@${this.pkg.version}`)
		} else {
			// @ts-ignore
			saveFileJson(this.pkg.path, this.pkg.toJSON())
		}

		this.out.info('Setting stage to changelog')
		this.stage = 'changelog'
	}

	async changelog() {
		const config = await this.getConfig()

		await this.getGitMessages()

		if (config.changelog) {
			const changelogConfig = config.changelog

			this.out.info(`Generating changelog`)

			const repoPath = await this.getRepoPath()
			const gitRelativePath = path.relative(repoPath, this.pkg.dir).replace(/\\/g, '/')
			const results = await gitLog(repoPath, this.lastTagName, gitRelativePath)

			if (results.trim().length) {
				let changelog = `## ${this.version}\n\n`

				if (this.bumpType) {
					changelog += `### ${upwords(this.bumpType)} Changes\n\n`
				}

				changelog += results.replace(/^"\* (.*?) ?\((.*?)\)*"$/gm, `- $2: $1`)

				const changelogPath = path.join(this.pkg.dir, changelogConfig.file)

				let header = ''
				let body = ''
				if (fileExists(changelogPath)) {
					const logLines = getFile(changelogPath).split('\n')
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

				const final = `${header}\n\n${changelog}\n${body}`
				if (config.dryRun) {
					this.out.force.warn(`DRY RUN: Saving changelog to ${changelogPath}`)
				} else {
					saveFile(changelogPath, final)
				}
			} else {
				this.out.warn('No git log found, skipping changelog')
			}
		}

		this.stage = 'commit'
	}

	async commit() {
		const config = await this.getConfig()

		if (config.git) {
			await this.getGitMessages()

			this.out.debug('Adding changes')

			const paths = [this.pkg.path]


			if (config.changelog) {
				const changelogConfig = config.changelog
				const changeLogPath = path.join(this.pkg.dir, changelogConfig.file)
				if (fileExists(changeLogPath)) {
					paths.push(changeLogPath)
				}
			}

			if (config.dryRun) {
				this.out.force.warn(`DRY RUN: git add ${paths.join(' ')}`)
			} else {
				await gitAdd(this.dir, ...paths)
			}

			this.out.info('Committing changes')


			if (config.dryRun) {
				this.out.force.warn(`DRY RUN: git commit --message "${this.commitMessage}"`)
			} else {
				await gitCommit(this.dir, this.commitMessage)
			}

			this.out.debug('Tagging release')


			if (config.dryRun) {
				this.out.force.warn(`DRY RUN: git tag --annotate --message="${this.tagMessage}" ${this.tagName}`)
			} else {
				await gitTag(this.dir, this.tagName, this.tagMessage)
			}

			this.out.info('Marking to be pushed and published')
		}

		this.stage = 'push'
	}

	async push() {
		const repoPath = await this.getRepoPath()
		if (cache.pushedRepos.has(repoPath)) {
			this.out.debug(`Skipping already pushed repo: ${repoPath}`)
		} else {
			const config = await this.getConfig()
			const branch = await this.getBranch()

			this.out.debug('Pushing changes')
			if (config.dryRun) {
				this.out.force.warn(`DRY RUN: git push`)
			} else {
				const status = await gitBehindUpstream(this.dir, branch)
				if (!status.length) {
					this.out.debug('Nothing to push, skipping')
				} else {
					await gitPush(this.dir, branch)
					cache.pushedRepos.add(repoPath)
					this.publishReady = true
				}
			}
		}

		this.publishReady = true
		this.stage = 'publish'
	}

	async publish() {
		const config = await this.getConfig()

		if (config.npm && config.npm?.publish && this.version !== this.pkg.npm_version) {
			const npmConfig = config.npm

			if (this.scripts?.prepublish) {
				this.out.info(`Running prepublish script`)

				if (config.dryRun) {
					this.out.force.warn(`DRY RUN: ${this.scripts.prepublish}`)
				} else {
					await execaCommand(this.scripts.prepublish, {cwd: this.dir})
				}
			}

			this.out.info('Publishing package')

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
				await execa('npm', npmPublishArgs, {cwd: this.dir, stdout: 'inherit'})
			} catch (e) {
				$out.error('Publishing failed', e.message)
			}

			if (this.scripts?.postpublish) {
				this.out.info(`Running postpublish script`)
				if (config.dryRun) {
					this.out.force.warn(`DRY RUN: ${this.scripts.postpublish}`)
				} else {
					await execaCommand(this.scripts.postpublish, {cwd: this.dir})
				}
			}
		} else {
			this.out.warn('Publishing skipped')
		}
	}
}



