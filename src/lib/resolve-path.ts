import {posix} from '../common'
import {getRequiresExtension} from './get-tsconfig'

const extensionRegex = /\.(m)?[jt]s(x)?$/

export async function resolvePath(source: string, file: string): Promise<string> {
	const resolvedIndex = posix.resolve(source)
	const resolvedFile = posix.resolve(file)
	const requiresExtension = await getRequiresExtension(resolvedFile)

	let results = posix.relative(resolvedIndex, resolvedFile)
		.replace(/^(\.{1,2}\/)*/, './')
		.replace(extensionRegex, requiresExtension ? '.$1js$2' : '')
		.replace(/\/index$/, '')

	if (results === '.') {
		results = './index'
	}

	if (requiresExtension && !extensionRegex.test(results)) {
		results += '/index.js'
	}

	return results
}
