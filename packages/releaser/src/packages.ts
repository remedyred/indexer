import {$out, $run, awaitProcesses, getConfig, maxProcesses, processes} from './config'
import {count, interpolate, isEmpty, isObject, parse} from '@snickbit/utilities'
import {progress} from '@snickbit/node-utilities'
import {Pkg} from './Pkg'
import {gitBehindUpstream, gitLog, gitRepoPath} from './git'
import {npmVersion} from './npm'
import {Release, ShouldPublishResults} from './Release'
import {getDependentMap, getPackageInfos, PackageInfo, PackageInfos} from 'workspace-tools'
import Topo from '@hapi/topo'
import * as path from 'path'

export type TopologicalGraph = {
	[name: string]: {
		location: string;
		dependencies: string[];
	};
};

export interface Workspace {
	root: string
	allPackages: PackageInfos
}

let showForceBumpMessage = false

export async function findPackages(): Promise<Pkg[]> {
	// gather packages
	$run.packageInfos = getPackageInfos($run.cwd)

	const $progress = progress({message: 'Checking for eligible packages', total: count($run.packageInfos)}).start()
	const errors: string[] = []
	const warnings: string[] = []
	const results: Pkg[] = []

	for (let packageName in $run.packageInfos) {
		const packageInfo = $run.packageInfos[packageName]

		if (processes.length >= maxProcesses) await awaitProcesses()
		processes.push(loadPackage(packageInfo).then((result: Pkg | string) => {
			if (isObject(result)) {
				results.push(result as Pkg)
			} else {
				warnings.push(result as string)
			}
		}).catch(err => {
			errors.push(err.message)
		}).finally(() => $progress.tick()))
	}
	await awaitProcesses()
	$progress.finish()

	if (!isEmpty(errors)) {
		for (let error of errors) {
			$out.broken.error(...error.split('\n'))
		}
	}

	if (!isEmpty(warnings)) {
		for (let warning of warnings) {
			$out.broken.warn(...warning.split('\n'))
		}
	}

	if (showForceBumpMessage) {
		$out.force.info('You can force a bump by using the --force flag.')
	}

	return sortTopologically(results) as Pkg[]
}

async function loadPackage(packageInfo: PackageInfo): Promise<Pkg | string> {
	const config = await getConfig()

	if (!packageInfo) {
		throw new Error('Package not found')
	}

	if (packageInfo.private && !config.allowPrivate) {
		return `{magenta}${packageInfo.name}{/magenta} Skipping private package`
	}

	const should_publish = await shouldPublish(packageInfo)
	if (!should_publish.pass) {
		showForceBumpMessage = true
		return `{magenta}${packageInfo.name}{/magenta} Package version matches published | No commits to push`
	}

	return new Pkg(packageInfo, should_publish)
}

export async function shouldPublish(packageInfo: PackageInfo): Promise<ShouldPublishResults> {
	const config = await getConfig()

	const results: ShouldPublishResults = {
		pass: false,
		npm_version: '0.0.0',
		behindUpstream: 0,
		tests: [config.force]
	}

	if (config.npm) {
		results.npm_version = await npmVersion(packageInfo.name)
		results.tests.push(results.npm_version !== packageInfo.version)
	}

	if (config.git) {
		const gitConfig = config.git
		if (results.npm_version) {
			const lastTagName = interpolate(gitConfig.tagName, {name: packageInfo.name, version: results.npm_version})
			const pkgDir = path.dirname(packageInfo.packageJsonPath)
			const repoPath = await gitRepoPath(pkgDir)
			const gitRelativePath = path.relative(repoPath, pkgDir).replace(/\\/g, '/')
			results.behindUpstream = (await gitLog(repoPath, lastTagName, gitRelativePath)).split('\n').length
		} else {
			results.behindUpstream = parse((await gitBehindUpstream(path.dirname(packageInfo.packageJsonPath))).match(/0\s+\d+/))
		}

		results.tests.push(results.behindUpstream > 0)
	}

	results.pass = results.tests.some(result => result === true)

	return results
}

export type TopoSortSubject = Pkg | Release

export function sortTopologically(packages: TopoSortSubject[]): TopoSortSubject[] {
	if (!$run.toposort) {
		const graph = new Topo.Sorter()
		const dependencyMap = getDependentMap($run.packageInfos)
		for (const packageName of dependencyMap.keys()) {
			const dependentPackages = Array.from(dependencyMap.get(packageName))
			graph.add(packageName, {after: dependentPackages, manual: true})
			$run.dependencyMap[packageName] = dependentPackages
		}

		$run.toposort = graph.sort() as string[]
	}

	const toposort: TopoSortSubject[] = []
	for (let item of $run.toposort) {
		const pk = packages.find(pkg => pkg.name === item)
		if (pk) {
			toposort.push(pk)
		}
	}
	return toposort
}
