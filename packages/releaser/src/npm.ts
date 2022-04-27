import {exTrim} from './helpers'

export async function npmVersion(packageName: string): Promise<string> {
	return exTrim('npm', ['show', packageName, 'version'])
}
