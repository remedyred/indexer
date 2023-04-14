#!/usr/bin/env node
import {ask, confirm, saveFileJson} from '@snickbit/node-utilities'
import {$out, $state, Args, DEFAULT_CONFIG_NAME} from './common'
import {debounceAsync, objectExcept} from '@snickbit/utilities'
import {generateIndexes} from './'
import {name as packageName, version} from '../package.json'
import {GenerateConfig, setup, useConfig} from './lib/config'
import {useSources} from './lib/use-sources'
import {getIndexConfig} from './lib/get-index-config'
import {useOutputs} from './lib/use-outputs'
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

	if (argv.watch) {
		return watch()
	}

	if ($state.config || $state.args.source) {
		if ($state.config?.indexes) {
			const root: Omit<GenerateConfig, 'indexes'> = objectExcept<GenerateConfig>($state.config, ['indexes'])
			for (const key in $state.config.indexes) {
				$state.config.indexes[key] = await generate({...root, ...$state.config.indexes[key]})
			}
		} else {
			$state.config = await generate($state.config)
		}
	} else {
		$out.fatal('No configuration found and no source directory specified')
	}

	if (!$state.dryRun && !$state.configPath && await confirm('Do you want to save the configuration?')) {
		const save_path = $state.configPath || await ask('Path to save config file?', DEFAULT_CONFIG_NAME)
		if (!save_path) {
			$out.fatal('No path provided')
		}
		await saveFileJson(save_path, useConfig())
	}

	$out.done('Done')
}

async function generate(config: GenerateConfig): Promise<GenerateConfig> {
	$state.isGenerating = true
	const results = await generateIndexes(config)
	$state.isGenerating = false
	return results
}

async function watch() {
	const sources = useSources()
	const outputs = useOutputs($state.config)

	const debouncedGenerateIndexes = debounceAsync(generate, 200)
	let fileChanged = true

	chokidar
		.watch(sources, {persistent: true, ignored: outputs})
		.on('change', async file => {
			fileChanged = true
			$out.debug(`${file} changed`)
			const indexConfig = getIndexConfig(file)
			$out.verbose('Using index config:', indexConfig)
			if (indexConfig) {
				await debouncedGenerateIndexes(indexConfig)
			}
		}).on('ready', () => {
			if (!$state.isGenerating && fileChanged) {
				$out.info(`Waiting for file changes...`)
				fileChanged = false
			}
		}).on('all', (event, path) => {
			$out.label(event).verbose(path)
		})
}
