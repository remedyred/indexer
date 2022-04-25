#!/usr/bin/env node
import {cli} from '@snickbit/node-cli'
import {ask, fallOverConfig, getFileJson, Spinner} from '@snickbit/node-utilities'
import chokidar from 'chokidar'
import debounce from 'debounce'
import del from 'del'
import babler, {_out, default_config, getBabelConfig} from './index'

cli()
	.name('@snickbit/babler')
	.version(require('../package.json').version)
	.banner('Transpiling')
	.includeWorkingPackage()
	.args({
		src: {
			description: 'The source directory to watch',
			default: 'src'
		},
		dest: {
			description: 'The destination directory to output files to',
			default: 'dist'
		}
	})
	.options({
		minify: {
			alias: 'm',
			describe: 'Minify the output',
			default: default_config.minify
		},
		clean: {
			alias: 'c',
			describe: 'Clean the output before transpiling',
			default: default_config.clean
		},
		watch: {
			alias: 'w',
			describe: 'Watch for changes and transpile on the fly',
			default: default_config.watch
		},
		'no-copy': {
			alias: 'p',
			describe: 'Don\'t copy asset files to the destination',
			default: default_config.noCopy
		}
	})
	.run().then(async argv => {
	const babler_config = getFileJson('babler.config.json', {})
	const config = fallOverConfig(default_config, argv, babler_config)

	config.babel = getBabelConfig()

	_out.label('Config').verbose(config)

	while (!config.src) {
		config.src = await ask('Source directory: ')
	}

	while (!config.dest) {
		config.dest = await ask('Destination directory: ')
	}

	const $spinner = new Spinner()

	if (argv.clean) {
		$spinner.start('Cleaning destination directory')
		await del(config.dest)
		$spinner.finish('Cleaned destination directory')
	}

	if (config.watch) {
		_out.debug(`watch files`)
		const watcher = chokidar.watch(config.src, {
			ignored: [
				/(^|[\/\\])\../
			],
			persistent: true
		})
		watcher.on('all', debounce(async function () {
			try {
				await babler(config)
				_out.info('Waiting for changes...')
			} catch (e) {
				_out.alert(e)
			}
		}, 300))
	} else {
		await babler(config)
		_out.done('Done')
	}
})
