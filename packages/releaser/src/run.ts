import {$queue, releases} from './config'
import {Release, ReleaseStage} from './Release'
import {$render, sortTopologically} from '@remedyred/cli-utilities'

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
	$render.start()
	const $main = $render.add('Releaser')
	for (let stage of stages) {
		$main.info(`Starting stage ${stage}`)
		$stage = stage

		const active = sortTopologically(Object.values(releases).filter((release: Release) => release.stage === stage)) as Release[]

		$main.info(`Processing stage: {yellow}${stage}{/yellow} for {blueBright}${active.length}{/blueBright} releases`)

		for (let release of active) {
			queueRelease(release)
		}

		$main.info('Waiting for all releases to complete...')
		await $queue.run()
		$main.info('All queue items completed')
		await Promise.all(Object.values(activeReleases).map(release => release.promise))
		$main.info('All releases completed')
		activeReleases = {}
	}
	$main.info('All stages completed')

	$render.stop()
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
