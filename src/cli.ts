#!/usr/bin/env node
import {ask, confirm, fileExists, getFileJson, saveFileJson} from '@snickbit/node-utilities'
import {lilconfig} from 'lilconfig'
import {$out, DEFAULT_CONFIG_NAME} from './common'
import {AppConfig, IndexerConfig} from './definitions'
import {objectExcept} from '@snickbit/utilities'
import {generateIndexes} from './'
import cli from '@snickbit/node-cli'
import packageJson from '../package.json'

cli().name('@snickbit/indexer')
	.version(packageJson.version)
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
	.run()
	.then(async argv => {
		const config: AppConfig = {
			source: argv.source,
			output: argv.output,
			dryRun: argv.dryRun
		}

		if (config.source && !config.source.includes('*')) {
			config.source = `${config.source}/**/*`
		}

		let configPath

		if (argv.config && argv.config !== 'false' && fileExists(argv.config)) {
			configPath = argv.config
			config.indexer = getFileJson(argv.config)
		} else {
			const result = await lilconfig('indexer').search()
			if (result) {
				configPath = result.filepath
				config.indexer = result.config
			}
		}

		if (config.indexer || config.source) {
			const conf = config.indexer as IndexerConfig
			if (conf?.indexes) {
				const root: Omit<IndexerConfig, 'indexes'> = objectExcept(conf, ['indexes']) as IndexerConfig
				for (const key in conf.indexes) {
					conf.indexes[key] = await generateIndexes(config, {...root, ...conf.indexes[key]}) as IndexerConfig
				}
				config.indexer = conf
			} else {
				config.indexer = await generateIndexes(config)
			}
		} else {
			$out.fatal('No configuration found and no source directory specified')
		}

		if (!config.dryRun && !configPath && await confirm('Do you want to save the configuration?')) {
			const save_path = configPath || await ask('Path to save config file?', DEFAULT_CONFIG_NAME)
			if (!save_path) {
				$out.fatal('No path provided')
			}
			await saveFileJson(save_path, config.indexer)
		}

		$out.done('Done')
	})
