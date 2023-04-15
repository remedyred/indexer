import {IndexConfig} from './config'
import {mkdir, saveFile} from '@snickbit/node-utilities'
import {makeDefaultExport} from './make-default-export'
import {indexer_banner} from '../common'
import path from 'path'

/**
 * Save index file to disk
 */
export async function saveIndex(indexConf: IndexConfig, filePath: string, content: string[]) {
	mkdir(path.dirname(filePath), true)

	content = content.sort()

	if (indexConf.default && indexConf.default.source) {
		content = await makeDefaultExport(indexConf, content)
	}

	saveFile(filePath, `${indexer_banner}\n\n${content.join('\n')}\n`)
}
