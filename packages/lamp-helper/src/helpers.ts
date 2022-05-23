import {execa} from 'execa'
import {ask, getFile, Question, Spinner} from '@snickbit/node-utilities'
import Handlebars from 'handlebars'
import path from 'path'
import {Out} from '@snickbit/out'
import {hash as bcryptHash} from 'bcrypt-ts'

export const $out = new Out('lamp')

interface RunResults {
	stdout?: string
	stderr?: string
}

export async function test(...args) {
	try {
		return await runIn(process.cwd(), ...args)
	} catch (e) {
		return false
	}
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
		$out.error('Command returned error: ' + args.join(' '))
		$out.fatal(results.stderr)
	}

	return results.stdout
}


let $spinner: Spinner

export function start(message: any) {
	if ($spinner) {
		$spinner.start(message)
	} else {
		$spinner = new Spinner(message)
		$spinner.start()
	}
}

export function finish(message: any) {
	if ($spinner) {
		$spinner.finish(message)
		$spinner = undefined
	} else {
		$out.success(message)
	}
}

export function fail(message: any) {
	if ($spinner) {
		$spinner.fail(message)
	} else {
		$out.error(message)
	}
}

export async function hash(password): Promise<string> {
	return bcryptHash(password, 10)
}

export function useTemplate(name: string) {
	return Handlebars.compile(getFile(path.join(__dirname, '..', 'templates', name + '.hbs')))
}

export function template(name: string, data: any) {
	const $template = useTemplate(name)
	return $template(data)
}

export function cleanDomain(domain: string) {
	//trim http:// | https:// | www | and all spaces from domain
	return domain.replace(/\s/g, '').replace(/^(http|https):\/\//, '').replace(/^www\./, '')
}

export async function required(question: string, answer?: string, options?: Partial<Question>): Promise<string> {
	while (!answer) {
		answer = await ask(question, options)
	}
	return answer
}
