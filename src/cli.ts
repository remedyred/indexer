#!/usr/bin/env node
import {ask, confirm, saveFileJson} from '@snickbit/node-utilities'
import {$out, Args, DEFAULT_CONFIG_NAME} from './common'
import {objectExcept} from '@snickbit/utilities'
import {generateIndexes} from './'
import {name as packageName, version} from '../package.json'
import {setup, useState} from './state'
import {IndexerConfig, useConfig} from './config'
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
		}
	})
	.run(main)

async function main(argv: Args) {
	await setup(argv)
	const {configPath, dryRun} = useState()

	await generate()

	if (!dryRun && !configPath && await confirm('Do you want to save the configuration?')) {
		const save_path = configPath || await ask('Path to save config file?', DEFAULT_CONFIG_NAME)
		if (!save_path) {
			$out.fatal('No path provided')
		}
		await saveFileJson(save_path, useConfig())
	}

	$out.done('Done')
}

async function generate() {
	const $state = useState()
	if ($state.config || $state.args.source) {
		if ($state.config?.indexes) {
			const root: Omit<IndexerConfig, 'indexes'> = objectExcept<IndexerConfig>($state.config, ['indexes'])
			for (const key in $state.config.indexes) {
				$state.config.indexes[key] = await generateIndexes({...root, ...$state.config.indexes[key]})
			}
		} else {
			$state.config = await generateIndexes($state.config)
		}
	} else {
		$out.fatal('No configuration found and no source directory specified')
	}
}
