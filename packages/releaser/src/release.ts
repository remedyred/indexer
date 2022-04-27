import {execa, execaCommand} from 'execa'
import {$out, getConfig, ReleaserConfig, ReleaserGitConfig, ReleaserNpmConfig} from './config'
import {gitAdd, gitBehindUpstream, gitBranch, gitCommit, gitPush, gitTag, isGitClean} from './git'
import {Out} from '@snickbit/out'
import {Pkg} from './pkg'
import {interpolate} from '@snickbit/utilities'
import {saveFileJson} from '@snickbit/node-utilities'

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
	pushReady: boolean = false
	publishReady: boolean = false
	bumpReady: boolean = false
	branch: string = 'main'

	constructor(pkg: Pkg, version: string) {
		this.pkg = pkg
		this.out = new Out(this.pkg.name)
		this.version = version

		this.publishReady = this.pkg.npm_version === this.pkg.version
		this.bumpReady = true

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

		if (config.git) {
			const gitConfig = config.git as ReleaserGitConfig

			this.out.debug('Adding changes')
			if (config.dryRun) {
				this.out.force.warn(`DRY RUN: git add ${this.pkg.path}`)
			} else {
				await gitAdd(this.dir, this.pkg.path)
			}

			this.out.info('Committing changes')

			const commitMessage = interpolate(gitConfig.commitMessage, {name: this.name, version: this.version})
			if (config.dryRun) {
				this.out.force.warn(`DRY RUN: git commit --message "${commitMessage}"`)
			} else {
				await gitCommit(this.dir, commitMessage)
			}

			this.out.debug('Tagging release')

			const tagMessage = interpolate(gitConfig.tagMessage, {name: this.name, version: this.version})
			const tagName = interpolate(gitConfig.tagName, {name: this.name, version: this.version})
			if (config.dryRun) {
				this.out.force.warn(`DRY RUN: git tag --annotate --message="${tagMessage}" ${tagName}`)
			} else {
				await gitTag(this.dir, tagName, tagMessage)
			}

			this.out.info('Marking to be pushed and published')
		}

		this.pushReady = true
	}

	async push() {
		const config = await this.getConfig()
		const branch = await this.getBranch()

		this.out.debug('Pushing changes')
		if (config.dryRun) {
			this.out.force.warn(`DRY RUN: git push`)
		} else {
			const status = await gitBehindUpstream(this.dir, branch)
			if (!status.length) {
				this.out.debug('Nothing to push, skipping')
				return
			}
			await gitPush(this.dir, branch)
			this.publishReady = true
		}
	}

	async publish() {
		const config = await this.getConfig()

		if (config.npm && (config.npm as ReleaserNpmConfig)?.publish) {
			const npmConfig = config.npm as ReleaserNpmConfig

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
		}
	}
}



