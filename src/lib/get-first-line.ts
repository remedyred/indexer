import fs from 'fs'
import readline from 'readline'

/**
 * Get the first line of a file, helper for shouldIgnore
 */
export async function getFirstLine(pathToFile) {
	const readable = fs.createReadStream(pathToFile)
	const reader = readline.createInterface({input: readable})
	const line = await new Promise(resolve => {
		reader.once('line', line => {
			reader.close()
			resolve(line)
		})
	})
	readable.close()
	return line
}
