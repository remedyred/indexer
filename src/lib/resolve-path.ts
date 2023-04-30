import {posix} from '../common'
import {getTsconfig} from './get-tsconfig'
import picomatch from 'picomatch'

const extensionRegex = /\.(m)?[jt]s(x)?$/

export async function resolvePath(source: string, file: string): Promise<string> {
	const resolvedIndex = posix.resolve(source)
	const resolvedFile = posix.resolve(file)
	const {absoluteImportPaths, useExtension} = await getTsconfig(resolvedFile)

	for (const [key, relativePatterns] of Object.entries(absoluteImportPaths)) {
		const patterns = relativePatterns.map(v => v.replace(/^\.+\/?/, ''))
		if (picomatch.isMatch(source, patterns)) {
			const relativePath = posix.relative(key, file)
				.replace(/^(\.{1,2}\/)+/, '')
			const prefix = key.replace(/\/?\*+\/?$/, '')

			return `${prefix}/${relativePath}`
				.replace(extensionRegex, '')
		}
	}

	let results = posix.relative(resolvedIndex, resolvedFile)
		.replace(/^(\.{1,2}\/)*/, './')
		.replace(extensionRegex, useExtension ? '.$1js$2' : '')
		.replace(/\/index$/, '')

	if (results === '.') {
		results = './index'
	}

	if (useExtension && !extensionRegex.test(results)) {
		results += '/index.js'
	}

	return results
}
