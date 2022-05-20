import {Bump, BumpRecord} from './definitions'
import upwords from '@snickbit/upwords'
import {bumpTypes, useConfig} from './config'
import semverInc from 'semver/functions/inc'
import conventionalRecommendedBump from 'conventional-recommended-bump'
import {Pkg} from '@remedyred/cli-utilities'

export async function genBump(pkg: Pkg, type: Bump): Promise<BumpRecord>  {
	const config = await useConfig()

	let version: string
	if (config.conventionalCommits) {
		version = await new Promise((resolve) => {
			conventionalRecommendedBump({
				preset: `angular`,
				path: pkg.path
			}, (error, recommendation) => resolve(semverInc(pkg.version, recommendation.releaseType)))
		})
	} else {
		version = semverInc(pkg.version, type)
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
