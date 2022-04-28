import {execa, execaCommand} from 'execa'
import {$out, cache, getConfig, ReleaserConfig} from './config'
import {gitAdd, gitBehindUpstream, gitBranch, gitCommit, gitPush, gitRepoPath, gitTag, isGitClean} from './git'
import {Out} from '@snickbit/out'
import {Pkg} from './pkg'
import {interpolate} from '@snickbit/utilities'
import {fileExists, getFile, saveFile, saveFileJson} from '@snickbit/node-utilities'
import path from 'path'

export interface ShouldPublishResults {
	results: boolean
	npm_version: string
	behindUpstream: string
}

export type ReleaseName = string

export interface Release {
	[key: string | symbol]: any
}

export class Release {
	private _config: ReleaserConfig
	protected proxy: Release
	pkg: Pkg
	version?: string
	out: Out
	stage: string
	publishReady = false
	bumpReady = false
	branch = 'main'
	repoPath: string

	commitMessage?: string
	tagMessage?: string
	tagName?: string

	constructor(pkg: Pkg, version: string) {
		this.pkg = pkg
		this.out = new Out(this.pkg.name)
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

		this.stage = 'changelog'
	}

	async changelog() {
		const config = await this.getConfig()

		await this.getGitMessages()

		if (config.changelog) {
			const changelogConfig = config.changelog

			this.out.info(`Generating changelog`)

			const changelogVars = {
				version: this.version,
				name: this.name,
				date: new Date().toISOString(),
				gitRelativePath: await this.getRepoPath(),
				branch: await this.getBranch(),
				tagName: this.tagName,
				tagMessage: this.tagMessage,
				commitMessage: this.commitMessage
			}

			const changelogCommand = interpolate(changelogConfig.command, changelogVars)

			if (config.dryRun) {
				this.out.force.warn(`DRY RUN: ${changelogCommand}`)
			} else {
				const results = await execaCommand(changelogCommand, {cwd: this.dir})
				if (results.stderr) {
					this.out.force.error(results.stderr)
				} else if (results.stdout) {
					let changelog = results.stdout

					if (changelogConfig.format === 'markdown') {
						changelog = changelog.replace(/^\s*\* /gm, '- ')
						changelog = changelog.replace(/\n\n\n/gm, '\n\n')
						changelog = changelog.replace(/\n\n/gm, '\n')
					} else {
						changelog = changelog.replace(/^\s*\* /gm, '')
						changelog = changelog.replace(/\n\n\n/gm, '\n\n')
						changelog = changelog.replace(/\n\n/gm, '\n')
					}

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

					const final = `${header}\n\n${changelog}\n\n${body}`

					saveFile(path.join(this.pkg.dir, changelogConfig.file), final)
				}
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



