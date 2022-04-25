import {fileExists, getFileJson} from '@snickbit/node-utilities'
import {out} from '@snickbit/out'

export interface Argv {
	bump: 'major' | 'minor' | 'patch'
	dryRun: boolean
	allowPrivate: boolean
}

export interface ReleaseConfig {
	name?: string
	bump?: 'patch' | 'minor' | 'major' | number | boolean
	packageDir?: string
	packagePath?: string,
	script?: string
}

export async function getConfig(argv: Argv): Promise<any> {
	if (fileExists('releaser.config.json')) {
		return getFileJson('releaser.config.json')
	}

	if (fileExists('package.json')) {
		const config = getFileJson('package.json')
		if (config.releaser) {
			return config.releaser
		} else if (config.workspaces) {
			return config
		}
	}

	out.fatal('No config found')
}

export async function getWorkspaces(argv): Promise<string[]> {
	const config = await getConfig(argv)

	if (config.workspaces) {
		return config.workspaces
	}

	out.fatal('No workspaces defined')
}
