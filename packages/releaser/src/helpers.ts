import {execa} from 'execa'
import {Bump, BumpRecord} from './definitions'
import upwords from '@snickbit/upwords'
import {bumpTypes, getConfig} from './config'
import semverInc from 'semver/functions/inc'
import conventionalRecommendedBump from 'conventional-recommended-bump'
import {Pkg} from './Pkg'

export async function exTrim(cmd: string, args: string[], directory?: string) {
	let results

	try {
		results = await execa(cmd, args, {cwd: directory})
	} catch (e) {
		results = {stdout: '', stderr: ''}
	}

	return results.stdout.replace(/^\s+$/gm, '').trim()
}

export async function genBump(pkg: Pkg, type: Bump): Promise<BumpRecord>;
export async function genBump(ver: string, type: Bump): Promise<BumpRecord>;
export async function genBump(pkgOrVer: string | Pkg, type: Bump): Promise<BumpRecord> {
	const config = await getConfig()

	let version: string
	if (config.conventionalCommits && typeof pkgOrVer !== 'string') {
		const pkg = pkgOrVer as Pkg
		version = await new Promise((resolve) => {
			conventionalRecommendedBump({
				preset: `angular`,
				path: pkg.path
			}, (error, recommendation) => {
				resolve(semverInc(pkg.version, recommendation.releaseType))
			})
		})
	} else {
		version = semverInc(pkgOrVer as string, type)
	}

	return {
		title: upwords(type) + ` (${version})`,
		version,
		type
	}
}

export async function genBumps(pkg: Pkg): Promise<BumpRecord[]>;
export async function genBumps(ver: string): Promise<BumpRecord[]>;
export async function genBumps(pkgOrVer: any): Promise<BumpRecord[]> {
	const bumps: BumpRecord[] = []
	for (let type of bumpTypes) {
		bumps.push(await genBump(pkgOrVer, type))
	}
	return bumps
}
