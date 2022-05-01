#!/usr/bin/env node
import {cli} from '@snickbit/node-cli'
import {ask, confirm} from '@snickbit/node-utilities'
import semverInc from 'semver/functions/inc'
import {$out, $run, awaitProcesses, getConfig, maxProcesses, processes} from './config'
import {plural} from '@snickbit/utilities'
import {Pkg} from './Pkg'
import {template} from 'ansi-styles-template'
import {sortTopologically} from './packages'
import {Release, ReleaseStage} from './Release'

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

	if (!$run.packages.length) {
		$out.done('No packages to release!')
	}

	interface PackageChoice {
		title: string
		value: Pkg | string
	}

	let packagesToRelease: Pkg[]

	if (applyToAll) {
		packagesToRelease = $run.packages
	} else {
		const choices: PackageChoice[] = $run.packages.map(p => {
			let title = `{magenta}${p.name}{/magenta}`

			if (config.git) {
				title += ` {cyan}(${p.behind_upstream} ${plural('commit', p.behind_upstream)}){/cyan}`
			}

			return {
				title: template(title),
				value: p
			}
		})
		packagesToRelease = await ask('Which packages would you like to release?', {
			type: 'multiselect',
			choices
		})
	}

	const releases: Release[] = []

	for (let pkg of packagesToRelease) {
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
			// bump has to come last so applyToAll can be set to the bump value
			applyToAll = (await confirm(`Apply to all?`)) && bump
		}

		if (!bump) {
			$out.fatal('No bump version selected')
		}
		if (bump === 'skip') {
			$out.warn(`Skipping ${pkg.name}`)
			continue
		}

		try {
			releases.push(new Release(pkg, bump, versions[bump]))
		} catch (e) {
			$out.fatal('Failed to add release', e)
		}
	}

	const stages: ReleaseStage[] = [
		'bump',
		'changelog',
		'save',
		'commit',
		'push',
		'publish'
	]

	for (let stage of stages) {
		const active = sortTopologically(releases.filter((release: Release) => release.stage === stage))
		$out.info('Processing stage: {yellow}' + stage + '{/yellow} for {blueBright}', active.length, '{/blueBright} releases')
		for (let release of active) {
			if (processes.length >= maxProcesses) await awaitProcesses()
			let promise: Promise<any>
			try {
				promise = release[stage]()
			} catch (e) {
				$out.fatal(`Error while processing {yellow}${stage}{/yellow} for {magenta}${release.name}{magenta}`, e)
			}
			processes.push(promise.catch(err => $out.error(err)))
		}
		await awaitProcesses()
	}

	$out.block.ln().done('Done')
})
.catch(err => $out.error(err))
