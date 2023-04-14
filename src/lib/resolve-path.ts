import {posix} from '../common'

export function resolvePath(source: string, file: string): string {
	const resolvedIndex = posix.resolve(source)
	const resolvedFile = posix.resolve(file)
	let file_path = posix.relative(resolvedIndex, resolvedFile)
		.replace(/^(\.\.)?\/?/, './')
		.replace(/\.[jt]s$/, '')
		.replace(/\/index$/, '')
	if (file_path === '.') {
		file_path = './index'
	}
	return file_path
}
