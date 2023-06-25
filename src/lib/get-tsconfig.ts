import {findUp, getFileJSON, isDirectory} from '@snickbit/node-utilities'
import path from 'path'

interface TsConfigData {
	useExtension: boolean
}

const defaultTsConfigData: TsConfigData = {
	useExtension: false
}

const tsConfigCacheIndex = new Map<string, string>()
const tsConfigCache = new Map<string, TsConfigData>()

export async function getTsconfig(file?: string): Promise<TsConfigData> {
	const cwd = file ? (isDirectory(file) ? file : path.dirname(file)) : process.cwd()
	let tsconfig: string | undefined
	if (cwd && tsConfigCacheIndex.has(cwd)) {
		tsconfig = tsConfigCacheIndex.get(cwd)
	}
	if (tsconfig) {
		if (tsConfigCache.has(tsconfig)) {
			return tsConfigCache.get(tsconfig) as TsConfigData
		}
	} else {
		tsconfig = findUp('tsconfig.json', {cwd})
	}

	const results = {...defaultTsConfigData}
	if (!tsconfig) {
		return results
	}
	const tsconfigContent = getFileJSON(tsconfig)
	if (!tsconfigContent) {
		return results
	}

	const moduleResolution = (tsconfigContent.compilerOptions?.moduleResolution || '').toLowerCase()

	if (moduleResolution === 'nodenext' || moduleResolution === 'node16') {
		results.useExtension = true
	}

	tsConfigCache.set(tsconfig, results)
	tsConfigCacheIndex.set(cwd, tsconfig)

	return results
}

export async function getRequiresExtension(file?: string): Promise<boolean> {
	const {useExtension} = await getTsconfig(file)
	return useExtension
}
