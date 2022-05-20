import {Bump, BumpRecord} from './definitions'
import upwords from '@snickbit/upwords'
import {$out, bumpTypes} from './config'
import semverInc from 'semver/functions/inc'
import conventionalRecommendedBump from 'conventional-recommended-bump'
import {Pkg} from '@remedyred/cli-utilities'


export function getBumpColor(bump: Bump): string {
	if (bump === 'patch') return 'green'
	if (bump === 'minor') return 'yellow'
	if (bump === 'major') return 'red'
	return 'blue'
}

export async function genConventionalBump(pkg: Pkg): Promise<Omit<BumpRecord, 'title'>> {
	return new Promise((resolve) => {
		conventionalRecommendedBump({
			preset: `angular`,
			path: pkg.path
		}, (error, recommendation) => {
			if (!recommendation) {
				$out.force.error('No conventional bump found!', pkg.path, error)
				return {
					type: 'skip'
				}
			}

			resolve({
				version: semverInc(pkg.version, recommendation.releaseType),
				type: recommendation.releaseType
			})
		})
	})
}

export function genBump(pkg: Pkg, type: Bump): BumpRecord {
	let version = semverInc(pkg.version, type) as string

	return {
		title: upwords(type) + ` (${version})`,
		version,
		type
	}
}

export function genBumps(pkg: Pkg): BumpRecord[] {
	const bumps: BumpRecord[] = []
	for (let type of bumpTypes) {
		bumps.push(genBump(pkg, type))
	}
	return bumps
}
