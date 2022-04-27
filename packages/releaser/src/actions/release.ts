import {cli} from '@snickbit/node-cli'
import {out} from '@snickbit/out'
import {ask, confirm, fileExists, getFile, getFileJson, saveFile, saveFileJson} from '@snickbit/node-utilities'
import fg from 'fast-glob'
import os from 'os'
import semverInc from 'semver/functions/inc'
import {execa, execaCommand} from 'execa'
import {interpolate} from '@snickbit/utilities'
import changelog from 'changelog-io'
import * as path from 'path'

interface PackageJson {
	name: string
	version: string
	scripts?: Record<string, string>
}

export interface ReleaserConfig {
	workspaces: string[]
	commitMessage: string
	tagName: string
}

interface Argv {
	bump: 'major' | 'minor' | 'patch'
	dryRun: boolean
	allowPrivate: boolean
}

interface ReleaseConfig {
	name: string
	bump: 'patch' | 'minor' | 'major' | number | boolean
	packageDir: string
	packagePath: string
	pkg: PackageJson
	version: string
	dryRun: boolean
}

const defaultConfig: ReleaserConfig = {
	workspaces: [],
	commitMessage: 'chore(release): publish',
	tagName: '${name}@${version}'
}

let releaser: ReleaserConfig

export default async args => cli(args)
.arg('bump')
.options({
	allowPrivate: {
		alias: 'p',
		description: 'Allow private packages',
		type: 'boolean'
	}
})
.run()
.then(async (argv: Argv) => {
	out.fatal('Ready to release', argv)

	const workspaces = await getWorkspaces(argv)
	let configs: ReleaseConfig[] = []
	let applyToAll: boolean
	if (argv.bump) applyToAll = true

	for (let workspace of workspaces) {
		const packages = await fg(workspace, {onlyDirectories: true, absolute: true})
		for (let packageDir of packages) {
			const packagePath = packageDir + '/package.json'
			const pkg = getFileJson(packagePath)
			if (!pkg) {
				out.warn('No package.json found at ' + packageDir)
				continue
			}
			if (pkg.private && !argv.allowPrivate) {
				out.warn(`Skipping private package: {magenta}${pkg.name}{/magenta}`)
				continue
			}
			const {name, version} = pkg

			const versions = {
				patch: semverInc(version, 'patch'),
				minor: semverInc(version, 'minor'),
				major: semverInc(version, 'major')
			}

			const bump = argv.bump || applyToAll || await ask(`Bump version for ${name} (${version})?`, {
				type: 'select',
				choices: [
					{
						title: `Patch (${versions.patch})`,
						value: 'patch'
					},
					{
						title: `Minor (${versions.minor})`,
						value: 'minor'
					},
					{
						title: `Major (${versions.major})`,
						value: 'major'
					},
					{
						title: 'Skip',
						value: 'skip'
					}
				]
			})
			if (applyToAll === undefined) {
				applyToAll = (await confirm(`Apply to all?`)) && bump
			}

			if (!bump) {
				out.fatal('No bump version selected')
			}
			if (bump === 'skip') {
				out.warn(`Skipping ${name}`)
				continue
			}

			configs.push({
				name,
				packageDir,
				packagePath,
				pkg,
				bump,
				dryRun: argv.dryRun,
				version: versions[bump]
			})
		}
	}


	const maxProcesses = os.cpus().length
	const processes = []

	for (let config of configs) {
		if (processes.length >= maxProcesses) await Promise.all(processes)
		processes.push(bumpPackage(config))
	}
	await Promise.all(processes)
	out.block.done('Done')
})
.catch(err => out.error(err))

async function getConfig(argv) {
	if (releaser) return releaser

	let config: any = {}
	if (argv.config && fileExists(argv.config)) {
		config = getFileJson(argv.config)
	}

	if (!config.workspaces && fileExists('releaser.config.json')) {
		config = getFileJson('releaser.config.json')
	}

	if (!config.workspaces && fileExists('package.json')) {
		const pkg = getFileJson('package.json')
		if (pkg.releaser) {
			config = pkg.releaser
		} else if (pkg.workspaces) {
			config = {workspaces: pkg.workspaces}
		}
	}

	if (config.workspaces) {
		releaser = Object.assign(defaultConfig, config) as ReleaserConfig
		return releaser
	}

	out.fatal('No workspaces defined')
}

async function getWorkspaces(argv): Promise<string[]> {
	const config = await getConfig(argv)
	return config.workspaces
}

async function bumpPackage(config: ReleaseConfig) {
	const {name, packageDir, packagePath, bump, version, pkg} = config
	const _out = out.clone(pkg.name)

	const {scripts} = pkg

	if (scripts?.prerelease) {
		_out.info(`Running prerelease script`)
		await execaCommand(scripts.prerelease, {cwd: packageDir})
	}

	_out.info(`Bumping version to {magenta}${version}{/magenta}`)
	pkg.version = version
	saveFileJson(packagePath, pkg)

	const commitMessage = interpolate(releaser.commitMessage, {
		name,
		version,
		bump
	})

	const tagName = interpolate(releaser.tagName, {
		name,
		version,
		bump
	})

	_out.info('Generating change log')
	const changeFilePath = path.join(packageDir, 'CHANGELOG.md')
	let changeFile = getFile(changeFilePath, '')
	changeFile = '# Changelog\n\n' + changelog(tagName) + '\n\n' + changeFile.replace(/# Changelog\s+/, '').trim()
	saveFile(changeFilePath, changeFile)

	_out.info('Committing changes')
	await execa('git', ['add', config.packagePath, changeFilePath])
	await execa('git', ['commit', '-m', `'${commitMessage}'`])

	_out.info('Tagging release')
	await execa('git', ['tag', '-a', '-m', `'${tagName}'`])

	_out.info('Pushing changes')
	await execa('git', ['push', 'origin', '--tags'])

	if (scripts?.prepublish) {
		_out.info(`Running prepublish script`)
		await execaCommand(scripts.prepublish, {cwd: packageDir})
	}

	_out.info('Publishing package')
	await execa('npm', ['publish'], {cwd: packageDir})

	if (scripts?.postpublish) {
		_out.info(`Running postpublish script`)
		await execaCommand(scripts.postpublish, {cwd: packageDir})
	}

	_out.block.success('Done')
}
