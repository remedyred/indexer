#!/usr/bin/env node
import {cli} from '@snickbit/node-cli'
import {Out} from '@snickbit/out'
import {ask, confirm} from '@snickbit/node-utilities'
import semverInc from 'semver/functions/inc'
import {count, objectFilter} from '@snickbit/utilities'
import {$out, awaitProcesses, getConfig, maxProcesses, processes, ReleaseConfig, releases} from './config'
import {bumpPackage, findPackages, publishRelease, pushRelease} from './release'

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
			$out.fatal('No bump version selected')
		}
		if (bump === 'skip') {
			$out.warn(`Skipping ${name}`)
			continue
		}

		releases[pkg.name] = {
			name,
			pkg,
			bump,
			dryRun: argv.dryRun,
			version: versions[bump],
			out: new Out(pkg.name),
			pushReady: false,
			publishReady: pkg.npm_version === pkg.version, // if the package is already published, we don't need to publish it again
			bumpReady: true // if the package has been bumped, we don't need to bump it again
		}
	}

	const bumpableReleases = objectFilter(releases, (release: string, releaseConfig: ReleaseConfig) => releaseConfig.bumpReady)
	$out.ln.info(`Bumping versions for ${count(bumpableReleases)} packages`).ln()
	for (let release in bumpableReleases) {
		if (processes.length >= maxProcesses) await awaitProcesses()
		processes.push(bumpPackage(release).catch(err => $out.error(err)))
	}
	await awaitProcesses()

	const pushableReleases = objectFilter(releases, (release: string, releaseConfig: ReleaseConfig) => releaseConfig.pushReady)
	$out.ln.info(`Pushing repos for ${count(pushableReleases)} packages`).ln()
	for (let release in pushableReleases) {
		if (processes.length >= maxProcesses) await awaitProcesses()
		processes.push(pushRelease(release).catch(err => $out.error(err)))
	}
	await awaitProcesses()

	const publishableReleases = objectFilter(releases, (release: string, releaseConfig: ReleaseConfig) => releaseConfig.pkg.version !== releaseConfig.pkg.npm_version)
	$out.ln.info(`Publishing ${count(publishableReleases)} packages`).ln()
	for (let release in publishableReleases) {
		if (processes.length >= maxProcesses) await awaitProcesses()
		processes.push(publishRelease(release).catch(err => $out.error(err)))
	}
	await awaitProcesses()

	$out.block.ln().done('Done')
})
.catch(err => $out.error(err))
