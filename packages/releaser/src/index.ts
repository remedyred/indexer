#!/usr/bin/env node
import {cli} from '@snickbit/node-cli'
import {ask, confirm} from '@snickbit/node-utilities'
import semverInc from 'semver/functions/inc'
import {$out, awaitProcesses, getConfig, maxProcesses, processes, releases} from './config'
import {Release} from './release'
import {findPackages} from './packages'

cli()
.name('@snickbit/releaser')
.arg('bump')
.options({
	config: {
		alias: 'c',
		description: 'Release config file'
	},
	dryRun: {
		alias: 'd',
		description: 'Dry run',
		type: 'boolean'
	},
	allowPrivate: {
		alias: 'p',
		description: 'Allow private packages',
		type: 'boolean'
	},
	otp: {
		description: 'One time password for private packages',
		type: 'string'
	},
	access: {
		description: 'Access level for packages',
		type: 'string'
	},
	force: {
		alias: 'f',
		description: 'Force bump',
		type: 'boolean'
	}
})
.defaultAction('release')
.run()
.then(async (argv) => {
	const config = await getConfig(argv)

	let applyToAll: boolean
	if (argv.bump) applyToAll = true

	const packages = await findPackages(config.workspaces)
	for (let pkg of packages) {
		const versions = {
			patch: semverInc(pkg.version, 'patch'),
			minor: semverInc(pkg.version, 'minor'),
			major: semverInc(pkg.version, 'major')
		}

		const bump = argv.bump || applyToAll || await ask(`Bump version for ${pkg.name} (${pkg.version})?`, {
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
			$out.fatal('No bump version selected')
		}
		if (bump === 'skip') {
			$out.warn(`Skipping ${pkg.name}`)
			continue
		}

		releases.push(new Release(pkg, bump, versions[bump]))
	}
	const actions = [
		'bump',
		'changelog',
		'commit',
		'push',
		'publish'
	]

	for (let action of actions) {
		const processableReleases = releases.filter((release: Release) => release.stage === action)
		$out.info('Processing action', action, 'for', processableReleases.length, 'releases')
		for (let release of processableReleases) {
			if (processes.length >= maxProcesses) await awaitProcesses()
			let promise: Promise<any>
			try {
				promise = release[action]()
			} catch (e) {
				$out.fatal(`Error while processing ${action} for ${release.name}`, e)
			}
			processes.push(promise.catch(err => $out.error(err)))
		}
		await awaitProcesses()
	}

	$out.block.ln().done('Done')
})
.catch(err => $out.error(err))
