import {Out} from '@snickbit/out'
import {fileExists, getFileJson} from '@snickbit/node-utilities'
import os from 'os'
import {lilconfig} from 'lilconfig'
import path from 'path'
import {findPackages} from './packages'
import {Render} from './Render'
import {AppConfig, AppRun, Argv, ConfigTypes} from './definitions'
import {Queue} from '@snickbit/queue'
import {mergeDeep} from '@snickbit/utilities'

export const $queue = new Queue()

export const defaultConfig: AppConfig = {
	workspaces: [],
	git: false,
	npm: false
}

let config: AppConfig

export const $run: AppRun = {
	cwd: process.cwd(),
	packageInfos: {},
	packages: [],
	dependencyMap: {}
}

export const $out = new Out('app')

export const $render = new Render()

export const maxProcesses = os.cpus().length - 1
export const processes = []
export const awaitProcesses = async () => await Promise.all(processes.splice(0))

const configTypes: ConfigTypes = {
	app: ['force', 'dryRun', 'allowPrivate', 'config', 'all'],
	git: ['commitMessage', 'tagName', 'tagMessage'],
	npm: ['access', 'otp', 'registry']
}

export async function getConfig(name = 'cli', appDefaults: any = {}, argv?: Argv): Promise<AppConfig> {
	if (config) return config

	let conf: any
	if (argv?.config && fileExists(argv.config)) {
		conf = getFileJson(argv.config)
		$run.cwd = path.dirname(argv.config)
	} else {
		const result = await lilconfig(name).search()
		conf = result.config
		$run.cwd = path.dirname(result.filepath)
	}

	if (fileExists('package.json')) {
		let packageConfig = getFileJson('package.json')

		if ((!conf || !conf.workspaces)) {
			$run.cwd = process.cwd()
			if (packageConfig?.app?.workspaces) {
				packageConfig = packageConfig.app
			} else if (packageConfig.workspaces) {
				if (!conf) {
					conf = {workspaces: packageConfig.workspaces}
				} else if (!conf.workspaces) {
					conf.workspaces = packageConfig.workspaces
				}
			} else {
				$out.fatal('No workspaces found, no app config found.')
			}
		}

		conf.rootPackage = packageConfig
	}

	if (conf?.workspaces) {
		config = mergeDeep(defaultConfig, appDefaults, conf) as AppConfig

		// load config args from argv
		for (let [configType, configArgs] of Object.entries(configTypes)) {
			for (const configArg of configArgs) {
				if (argv?.[configArg]) {
					if (configType === 'app') {
						config[configArg] = argv[configArg]
					} else {
						config[configType] = config[configType] || {}
						config[configType][configArg] = argv[configArg]
					}
				}
			}
		}

		$run.packages = await findPackages()

		if (config.dryRun) {
			$out.force.warn('Dry run enabled')
		}

		return config
	}

	$out.fatal('No workspaces defined')
}

export function setConfigTypes(types: ConfigTypes) {
	for (let [configType, configArgs] of Object.entries(types)) {
		if (configType === 'app') {
			const old = configTypes[configType]
			configTypes[configType] = [...old, ...configArgs]
		} else {
			configTypes[configType] = configArgs
		}
	}
}
