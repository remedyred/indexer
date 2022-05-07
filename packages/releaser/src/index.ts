#!/usr/bin/env node
import {cli} from '@snickbit/node-cli'
import {ask, confirm} from '@snickbit/node-utilities'
import {$out, $run, getConfig, releases} from './config'
import {plural} from '@snickbit/utilities'
import {Pkg} from './Pkg'
import {template} from 'ansi-styles-template'
import {Release} from './Release'
import {Bump, BumpRecord} from './definitions'
import {genBump, genBumps} from './helpers'
import {run} from './run'

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

	let applyToAll: boolean | Bump
	if (argv.bump) applyToAll = argv.bump as Bump

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

	for (let pkg of packagesToRelease) {
		type SkipBumpRecord = Omit<BumpRecord, 'type'> & { type: Bump | 'skip' }

		const bumps = genBumps(pkg.version) as SkipBumpRecord[]

		bumps.push({
			title: 'Skip',
			type: 'skip'
		})

		let bump: SkipBumpRecord | Bump = applyToAll || await ask(`Bump version for ${pkg.name} (${pkg.version})?`, {
			type: 'select',
			choices: bumps.map(b => ({title: b.title, value: b}))
		})

		if (!bump) {
			$out.fatal('No bump version selected')
		}

		if (typeof bump === 'string') {
			bump = genBump(pkg.version, bump)
		}

		if (bump.type === 'skip') {
			$out.warn(`Skipping ${pkg.name}`)
			applyToAll = false
			continue
		}

		if (applyToAll === undefined && await confirm(`Apply to all?`)) {
			applyToAll = bump.type
		}

		try {
			releases[pkg.name] = new Release(pkg, bump.type, bump.version)
		} catch (e) {
			$out.fatal('Failed to add release', e)
		}
	}

	await run()

	$out.block.ln().done('Done')
})
.catch(err => $out.error(err))
