import {execa} from 'execa'

export async function exTrim(cmd: string, args: string[], directory?: string) {
	let results

	try {
		results = await execa(cmd, args, {cwd: directory})
	} catch (e) {
		results = {stdout: '', stderr: ''}
	}

	return results.stdout.replace(/^\s+$/gm, '').trim()
}
