import {Bump, BumpRecord} from './definitions'
import {$out, $queue, $run, releases} from './config'
import {Release, ReleaseStage} from './Release'
import {genBump} from './helpers'
import {sortTopologically} from './packages'
import {Pkg} from './Pkg'

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

		$out.info(`Processing stage: {yellow}${stage}{/yellow} for {blueBright}${active.length}{/blueBright} releases`)
		for (let release of active) {
			queueRelease(release)
		}

		await $queue.run()
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
	if (!stage) stage = $stage
	const releasePromise = release[stage]()
	.then(() => {
		// $out.success(`{green}${stage}{/green} {blueBright}${release.name}{/blueBright}`)
	})
	.catch(e => {
		// $out.fatal(`Error while processing {yellow}${stage}{/yellow} for {magenta}${release.name}{magenta}`, e)
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

export function addRelease(pkg: Pkg, bump: BumpRecord | Bump, queue?: boolean);
export function addRelease(packageName: string, bump: BumpRecord | Bump, queue?: boolean);
export function addRelease(pkgOrName: string | Pkg, bump: BumpRecord | Bump, queue?: boolean) {
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
		bump = genBump(pkg.version, bump)
	}

	releases[pkg.name] = new Release(pkg, bump.type, bump.version)

	if (queue) {
		queueRelease(releases[pkg.name])
	}
}
