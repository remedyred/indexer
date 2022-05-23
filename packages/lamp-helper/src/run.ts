import {execa} from 'execa'
import {$out} from './helpers'

interface RunResults {
	stdout?: string
	stderr?: string
}

export async function run(...args) {
	return runIn(process.cwd(), ...args)
}

export async function runIn(directory, ...args) {
	let results: RunResults

	try {
		results = await execa('sudo', args, {cwd: directory})
	} catch (e) {
		$out.error('Error running command: ' + args.join(' '))
		$out.fatal(e.stderr || e.stdout || e.message)
	}
	if (results.stderr) {
		$out.warn(results.stderr)
	}

	return results.stdout
}

export async function test(...args) {
	try {
		return await runIn(process.cwd(), ...args)
	} catch (e) {
		return false
	}
}
