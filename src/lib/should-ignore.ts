import {GenerateConfig} from './config'
import {fileExists} from '@snickbit/node-utilities'
import {isArray} from '@snickbit/utilities'
import {useOutputs} from './use-outputs'
import {getFirstLine} from './get-first-line'
import {indexer_banner} from '@/common'
import picomatch from 'picomatch'

/**
 * Whether or not to ignore a file
 */
export async function shouldIgnore(conf: GenerateConfig, file: string): Promise<boolean> {
	if (!fileExists(file)) {
		return true
	}

	if (isArray(conf.include) && conf.include.some(include => include && picomatch(include)(file))) {
		return false
	}

	if (isArray(conf.ignore) && conf.ignore.some(ignore => ignore && picomatch(ignore)(file))) {
		return true
	}

	if (useOutputs(conf).some(ignore => ignore && picomatch(ignore)(file)) || /\/index\.[a-z]+$/.test(file)) {
		return await getFirstLine(file) === indexer_banner
	}

	return file === conf.output
}
