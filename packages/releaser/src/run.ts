import {Bump, BumpRecord} from './definitions'
import {$out, $queue, $run, releases} from './config'
import {Release, ReleaseStage} from './Release'
import {genBump} from './helpers'
import {$render, Pkg, sortTopologically} from '@remedyred/cli-utilities'

export let $stage: ReleaseStage

const stages: ReleaseStage[] = [
	'bump',
	'changelog',
	'save',
	'commit',
	'push',
	'publish'
]

interface ActiveRelease {
	promise: Promise<any>
	dependents: string[]
}

export let activeReleases: Record<string, ActiveRelease> = {}

export async function run() {
	for (let stage of stages) {
		$stage = stage

		const active = sortTopologically(Object.values(releases).filter((release: Release) => release.stage === stage)) as Release[]

		$out.block.info(`Processing stage: {yellow}${stage}{/yellow} for {blueBright}${active.length}{/blueBright} releases`)
		$render.start()
		for (let release of active) {
			queueRelease(release)
		}

		await $queue.run()
		await Promise.all(Object.values(activeReleases).map(release => release.promise))
		$render.stop()

		activeReleases = {}
	}
}

export async function isDependent(packageName: string): Promise<any> {
	for (let activeRelease of Object.values(activeReleases)) {
		if (activeRelease.dependents.includes(packageName)) {
			return await activeRelease.promise
		}
	}
	return false
}

export function queueRelease(release: Release, stage?: ReleaseStage) {
	if (!stage) {
		stage = $stage
	}
	const releasePromise = release[stage]().catch(e => {
		$render.error(`Error while processing {yellow}${stage}{/yellow} for {magenta}${release.name}{magenta}`, e)
	}).finally(() => {
		if (release.name in activeReleases) {
			delete activeReleases[release.name]
		}
	})
	$queue.push(releasePromise)

	activeReleases[release.name] = {
		promise: releasePromise,
		dependents: release.dependencies
	}
}

export function addRelease(pkg: Pkg, bump: Bump | BumpRecord, queue?: boolean)
export function addRelease(packageName: string, bump: Bump | BumpRecord, queue?: boolean)
export function addRelease(pkgOrName: Pkg | string, bump: Bump | BumpRecord, queue?: boolean) {
	let pkg: Pkg
	if (typeof pkgOrName === 'string') {
		pkg = new Pkg($run.packageInfos[pkgOrName])
	} else {
		pkg = pkgOrName
	}

	if (!pkg) {
		$out.error(`Package not found: {magenta}${pkgOrName}{/magenta}`)
		return
	}

	if (pkg.name in releases) {
		$out.force.warn(`Skipping release {magenta}${pkg.name}{/magenta}`)
		return
	}

	if (typeof bump === 'string') {
		bump = genBump(pkg, bump)
	}

	releases[pkg.name] = new Release(pkg, bump.type, bump.version)

	if (queue) {
		queueRelease(releases[pkg.name])
	}
}
