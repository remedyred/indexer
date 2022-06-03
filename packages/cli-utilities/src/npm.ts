import {exTrim} from './commands'

let preferred_client: string

const npmClients = ['pnpm', 'yarn']

export async function npmVersion(packageName: string): Promise<string> {
	return exTrim('npm', ['show', packageName, 'version'])
}

export async function npmPreferredClient(config): Promise<string> {
	if (preferred_client) {
		return preferred_client
	}

	if (config.npm && config.npm.client) {
		preferred_client = config.npm.client
		return preferred_client
	}

	const rootPackageScripts = JSON.stringify(config.rootPackage?.scripts || {})
	const rootPackage = JSON.stringify(config.rootPackage || {})

	for (let client of npmClients) {
		if (rootPackageScripts.includes(client)) {
			preferred_client = client
			return preferred_client
		}

		if ((await exTrim(client, ['--version'])).length) {
			preferred_client = client
			return preferred_client
		}

		if (rootPackage.includes(client)) {
			preferred_client = client
			return preferred_client
		}
	}

	preferred_client = 'npm'
	return preferred_client
}
