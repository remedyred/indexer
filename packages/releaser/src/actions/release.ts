import {cli} from '@snickbit/node-cli'
import {out} from '@snickbit/out'
import {ask, confirm, fileExists, getFileJson} from '@snickbit/node-utilities'
import fg from 'fast-glob'
import os from 'os'
import semverInc from 'semver/functions/inc'
import {execaCommand} from 'execa'

const releaseOptions = {
	git: {
		commitMessage: 'chore(release): publish',
		tagName: '{{name}}@${version}'
	}
}

interface Argv {
	bump: 'major' | 'minor' | 'patch'
	dryRun: boolean
	allowPrivate: boolean
}

interface ReleaseConfig {
	name?: string
	bump?: 'patch' | 'minor' | 'major' | number | boolean
	packageDir?: string
	packagePath?: string,
	script?: string
}

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
	let configs: Partial<ReleaseConfig>[] = []
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
			if (!pkg?.scripts?.release) {
				out.warn(`Skipping package {magenta}${pkg.name}{/magenta} without release script`)
				continue
			}
			const script = pkg.scripts.release
			const {name, version} = pkg
			const patch = semverInc(version, 'patch')
			const minor = semverInc(version, 'minor')
			const major = semverInc(version, 'major')

			const bump = argv.bump || applyToAll || await ask(`Bump version for ${name} (${version})?`, {
				type: 'select',
				choices: [
					{
						title: `Patch (${patch})`,
						value: 'patch'
					},
					{
						title: `Minor (${minor})`,
						value: 'minor'
					},
					{
						title: `Major (${major})`,
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
				bump,
				script
			})
		}
	}


	const maxProcesses = os.cpus().length
	const processes = []

	for (let config of configs) {
		if (processes.length >= maxProcesses) await Promise.all(processes)
		if (argv.dryRun) {
			out.force.warn(`Dry run: {magenta}${config.name}{/magenta}`, `{cyan}${config.script}{/cyan}`)
		} else {
			processes.push(execaCommand(`${config.script} ${config.bump}`, {cwd: config.packageDir, stdio: 'inherit'}))
		}
	}
	await Promise.all(processes)
	out.block.done('Done')
})
.catch(err => out.error(err))


async function getWorkspaces(argv): Promise<string[]> {
	if (fileExists('releaser.config.json')) {
		const config = getFileJson('releaser.config.json')
		if (config.workspaces) {
			return config.workspaces
		}
	}

	if (fileExists('package.json')) {
		const config = getFileJson('package.json')
		if (config.workspaces) {
			return config.workspaces
		} else if (config.releaser.workspaces) {
			return config.releaser.workspaces
		}
	}

	out.fatal('No workspaces defined')
}
