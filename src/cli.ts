#!/usr/bin/env node
import {ask, confirm, saveFileJson} from '@snickbit/node-utilities'
import {$out, $state, Args, DEFAULT_CONFIG_NAME} from './common'
import {name as packageName, version} from '../package.json'
import {setup, useConfig} from './lib/config'
import {watch} from './watch'
import {indexer} from './index'
import cli from '@snickbit/node-cli'

cli()
	.name(packageName)
	.version(version)
	.banner('Generating Indexes')
	.includeWorkingPackage()
	.args({
		source: {description: 'The source directory to index (only for initial run)'},
		output: {describe: 'Path to output file (only for initial run)'}
	})
	.options({
		config: {
			alias: 'c',
			describe: 'Path to config file',
			type: 'string',
			default: DEFAULT_CONFIG_NAME
		},
		dryRun: {
			alias: ['d', 'dry'],
			describe: 'Dry run, do not write to disk'
		},
		watch: {
			alias: 'w',
			describe: 'Watch for changes and regenerate indexes'
		}
	})
	.run(main)

async function main(argv: Args) {
	await setup(argv)

	if (argv.watch) {
		return watch()
	}

	$state.config = await indexer($state.config)

	if (!$state.dryRun && !$state.configPath && await confirm('Do you want to save the configuration?')) {
		const save_path = $state.configPath || await ask('Path to save config file?', DEFAULT_CONFIG_NAME)
		if (!save_path) {
			$out.fatal('No path provided')
		}
		await saveFileJson(save_path, useConfig())
	}

	$out.done('Done')
}
