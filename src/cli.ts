#!/usr/bin/env node
import {ask, confirm, saveFileJson} from '@snickbit/node-utilities'
import {$out, $state, Args, DEFAULT_CONFIG_NAME} from './common'
import {objectExcept} from '@snickbit/utilities'
import {generateIndexes} from './'
import {name as packageName, version} from '../package.json'
import {GenerateConfig, setup, useConfig} from './lib/config'
import {useSources} from './lib/use-sources'
import cli from '@snickbit/node-cli'
import chokidar from 'chokidar'

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
	const {configPath, dryRun} = $state

	if (argv.watch) {
		return watch()
	}

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
	if ($state.config || $state.args.source) {
		if ($state.config?.indexes) {
			const root: Omit<GenerateConfig, 'indexes'> = objectExcept<GenerateConfig>($state.config, ['indexes'])
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

async function watch() {
	const sources = useSources()
	$out.broken.fatal('sources: ', {sources})

	chokidar
		.watch('src', {persistent: true})
		.on('change', async file => {
			$out.debug(`${file} changed`)
			const {changed_files} = $state
			if (!changed_files.includes(file)) {
				changed_files.push(file)
			}
			await generate()
		}).on('ready', () => {
			$out.info(`Waiting for file changes...`)
		}).on('all', (event, path) => {
			$out.label(event).verbose(path)
		})
}
