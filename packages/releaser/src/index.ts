#!/usr/bin/env node
import {cli} from '@snickbit/node-cli'
import {ask, confirm} from '@snickbit/node-utilities'
import {$out, $run, releases, useConfig} from './config'
import {plural} from '@snickbit/utilities'
import {template} from 'ansi-styles-template'
import {Release} from './Release'
import {Bump, BumpRecord} from './definitions'
import {genBump, genBumps, genConventionalBump, getBumpColor} from './helpers'
import {run} from './run'
import {Pkg} from '@remedyred/cli-utilities'
import packageJson from '../package.json'

cli()
	.name('@snickbit/releaser')
	.version(packageJson.version)
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
		all: {
			alias: 'a',
			description: 'Select all packages',
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
	.then(async argv => {
		const config = await useConfig(argv)

		let applyToAll: Bump | boolean
		if (argv.bump) {
			applyToAll = argv.bump as Bump
		}

		if (!$run.packages.length) {
			$out.done('No packages to release!')
		}

	interface PackageChoice {
		title: string
		value: Pkg | string
	}

	let packagesToRelease: Pkg[]

	if (applyToAll || config.all) {
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

	let messages: string[] = []

	const stats = {} as Record<Bump, number>

	for (let pkg of packagesToRelease) {
		type SkipBumpRecord = Omit<BumpRecord, 'type'> & {type: Bump | 'skip'}

		let bump: Bump | SkipBumpRecord
		if (config.conventionalCommits) {
			bump = await genConventionalBump(pkg) as SkipBumpRecord

			if (bump.type !== 'skip') {
				stats[bump.type] = (stats[bump.type] || 0) + 1
				const color = getBumpColor(bump.type)
				messages.push(`{magenta}${pkg.name}{/magenta} {${color}}${bump.type}{/${color}} ${pkg.version} => {blueBright}${bump.version}{/blueBright}`)
			}
		} else {
			const bumps = genBumps(pkg) as SkipBumpRecord[]

			bumps.push({
				title: 'Skip',
				type: 'skip'
			})

			bump = applyToAll || await ask(`Bump version for ${pkg.name} (${pkg.version})?`, {
				type: 'select',
				choices: bumps.map(b => ({title: b.title, value: b}))
			})
		}

		if (!bump) {
			$out.fatal('No bump version selected')
		}

		if (typeof bump === 'string') {
			bump = genBump(pkg, bump)
		}

		if (bump.type === 'skip') {
			$out.warn(`Skipping ${pkg.name}`)
			applyToAll = false
			continue
		}

		if (!config.conventionalCommits && applyToAll === undefined && await confirm(`Apply to all?`)) {
			applyToAll = bump.type
		} else {
			applyToAll = false
		}

		try {
			releases[pkg.name] = new Release(pkg, bump.type, bump.version)
		} catch (e) {
			$out.fatal('Failed to add release', e)
		}
	}

	if (config.conventionalCommits) {
		let topMessage = 'Results:'
		for (let bump of Object.keys(stats)) {
			const color = getBumpColor(bump as Bump)
			topMessage += ` {${color}}${plural(bump, stats[bump])}{/${color}}: ${stats[bump]}`
		}

		messages.unshift(topMessage, '')

		$out.broken.ln.info(...messages).ln()

		if (!await confirm('Are you sure you want to publish these packages?')) {
			$out.fatal('Aborting')
		}
	}

	await run()

	$out.block.ln.done('Done')
	}).catch(err => $out.error(err))
