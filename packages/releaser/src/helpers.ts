import {execa} from 'execa'
import {Bump, BumpRecord} from './definitions'
import upwords from '@snickbit/upwords'
import {bumpTypes} from './config'
import semverInc from 'semver/functions/inc'

export async function exTrim(cmd: string, args: string[], directory?: string) {
	let results

	try {
		results = await execa(cmd, args, {cwd: directory})
	} catch (e) {
		results = {stdout: '', stderr: ''}
	}

	return results.stdout.replace(/^\s+$/gm, '').trim()
}

export function genBump(ver: string, type: Bump): BumpRecord {
	const version = semverInc(ver, type)

	return {
		title: upwords(type) + ` (${version})`,
		version,
		type
	}
}

export function genBumps(ver: string): BumpRecord[] {
	const bumps: BumpRecord[] = []
	for (let type of bumpTypes) {
		bumps.push(genBump(ver, type))
	}
	return bumps
}
