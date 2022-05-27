import * as babel from '@babel/core'
import {findUp, progress, Spinner} from '@snickbit/node-utilities'
import {Out} from '@snickbit/out'
import fs from 'fs'
import glob from 'glob'
import path from 'path'
import {minify} from 'terser'

export const _out = new Out('babbler')

export const default_config = {
	minify: false,
	clean: false,
	watch: false,
	noCopy: false
}

export const default_babel_config = {presets: ['@babel/preset-env']}

const parseEnv = string => string.replace(/\${([^}]+)}/g, (match, p1) => process.env[p1] || match)

const escapeRegExp = string => parseEnv(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const escapeReplacement = string => parseEnv(string).replace(/\$/g, '$$$$')

function safeReplace(string, replacements) {
	for (let [from, to] of Object.entries(replacements)) {
		const parsed_from = parseEnv(from)
		const parsed_to = parseEnv(to)
		string = string.replace(new RegExp(escapeRegExp(parsed_from), 'g'), escapeReplacement(parsed_to))
	}
	return string
}

/*

 async function verifyPackagesInstalled(babel_config) {
 _out.debug('Verifying packages are installed')

 const required_packages = ['@babel/core']

 if(babel_config.presets) {
 for(let preset of babel_config.presets) {
 if(typeOf(preset) === 'array') preset = preset.shift()
 preset = preset.startsWith('@babel/preset-') ? preset : `@babel/preset-${preset}`
 required_packages.push(preset)
 }
 }

 if(babel_config.plugins) {
 for(let plugin of babel_config.plugins) {
 if(typeOf(plugin) === 'array') plugin = plugin.shift()
 plugin = plugin.startsWith('babel-plugin-') ? plugin : `babel-plugin-${plugin}`
 required_packages.push(plugin)
 }
 }

 if(required_packages.length) {
 _out.warn(`Verifying required packages are installed...`)
 installPackage(required_packages, {install: 'global'})
 }
 }
 */

export default async function (config) {
	// await verifyPackagesInstalled(config.babel)

	const $spinner = new Spinner('Scanning files...')
	$spinner.start()

	const files = glob.sync('**/*.*', {cwd: config.src})
	$spinner.finish(`Found ${files.length} files`)

	let promises = []

	_out.verbose('Babel config:', config.babel)

	const $progress = progress({
		message: 'Transpiling',
		total: files.length
	})
	$progress.start()
	for (let file of files) {
		let source_path = path.join(config.src, file)
		let dest_path = path.join(config.dest, file.replace(/\.ts$/, '.js'))

		if (fs.lstatSync(source_path).isDirectory()) {
			continue
		}

		if (/\.([cm]?js|vue|ts)$/.test(source_path)) {
			_out.debug(`Transpiling ${source_path} to ${dest_path}`)

			let transpile_request = babel.transformFileAsync(source_path, config.babel)
			promises.push(transpile_request)
			transpile_request.then(async result => {
				if (result && result.code) {
					if (config.minify) {
						_out.debug(`Minifying ${source_path}`)
						const minified = await minify(result.code, {
							toplevel: true,
							format: {
								comments: 'all'
							}
						})
						result.code = minified.code || result.code
					}
					if (config.replacer) {
						_out.debug(`Running replacer on ${source_path}`)
						result.code = safeReplace(result.code, config.replacer)
					}

					saveTranspiled(result.code, dest_path)
				}
				$progress.tick()
			}).catch(err => {
				_out.error(err)
				$progress.fail(`Failed to transpile ${source_path}`)
			})
		} else if (!config.noCopy) {
			_out.debug(`Copying ${source_path} to ${dest_path}`)
			let copy_request = copyAsset(source_path, dest_path)
			promises.push(copy_request)
			copy_request.then(() => $progress.tick())
				.catch(err => {
					_out.fatal(err)
					$progress.fail(`Failed to copy ${source_path} to ${dest_path}`)
				})
		}
	}

	if (promises.length) {
		_out.debug('Waiting for transpiles to complete...')
		await Promise.all(promises)
	}
	$progress.finish('Transpiling complete')
}

function checkDir(dest_path) {
	const parent_path = path.dirname(dest_path)
	if (!fs.existsSync(parent_path)) {
		fs.mkdirSync(parent_path, {recursive: true})
	}
}

function saveTranspiled(code, dest_path) {
	checkDir(dest_path)
	_out.debug(`writing to ${dest_path}`)
	fs.writeFileSync(dest_path, code)
}

async function copyAsset(source_path, dest_path) {
	checkDir(dest_path)
	_out.debug(`writing to ${dest_path}`)
	fs.copyFileSync(source_path, dest_path)
}

export function getBabelConfig() {
	const babel_config_files = [
		'babel.config.js',
		'babel.config.json',
		'.babelrc'
	]
	for (let babel_config_file of babel_config_files) {
		const path = findUp(babel_config_file)
		if (path) {
			try {
				return require(path) || default_babel_config
			} catch (e) {
				_out.error(`Failed to load babel config from ${path}`)
			}
		}
	}

	return default_babel_config
}
