#!/usr/bin/env node
import {cli} from '@snickbit/node-cli'
import {ask, Spinner} from '@snickbit/node-utilities'
import {lilconfig} from 'lilconfig'
import babbler, {_out, default_config} from './index'
import chokidar from 'chokidar'
import debounce from 'debounce'
import del from 'del'
import packageJson from '../package.json'

cli()
	.name('@snickbit/babbler')
	.version(packageJson.version)
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
		const babbler_result = await lilconfig('babbler', {searchPlaces: ['package.json', 'babbler.config.json', 'babbler.conf.js']}).search()
		const config = babbler_result.config
		const babel_result = await lilconfig('babel', {searchPlaces: ['package.json', 'babel.config.json', 'babel.conf.js']}).search()
		config.babel = babel_result.config

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
				ignored: [/(^|[/\\])\../],
				persistent: true
			})
			watcher.on('all', debounce(async () => {
				try {
					await babbler(config)
					_out.info('Waiting for changes...')
				} catch (e) {
					_out.alert(e)
				}
			}, 300))
		} else {
			await babbler(config)
			_out.done('Done')
		}
	})
