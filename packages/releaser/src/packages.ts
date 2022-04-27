import {$out, awaitProcesses, getConfig, maxProcesses, PackageJson, processes} from './config'
import fg from 'fast-glob'
import {isEmpty, isObject} from '@snickbit/utilities'
import {getFileJson, progress} from '@snickbit/node-utilities'
import {Pkg} from './pkg'
import {gitBehindUpstream} from './git'
import {npmVersion} from './npm'
import {ShouldPublishResults} from './release'

export async function findPackages(workspaces: string[]): Promise<Pkg[]> {
	$out.info('Finding packages...', workspaces)
	// gather packages
	let $progress = progress({message: 'Scanning workspace for packages', total: workspaces.length}).start()
	const files: string[] = []
	for (let workspace of workspaces) {
		files.push(...await fg(workspace, {onlyDirectories: true, absolute: true}) as string[])
		$progress.tick()
	}
	$progress.finish()

	$progress = progress({message: 'Checking for eligible packages', total: files.length}).start()
	const errors: string[] = []
	const warnings: string[] = []
	const results: Pkg[] = []

	for (let fileDir of files) {
		if (processes.length >= maxProcesses) await awaitProcesses()
		processes.push(loadPackage(fileDir).then((result: Pkg | string) => {
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
			$out.broken.force.warn(...warning.split('\n'))
		}
	}

	return results
}

async function loadPackage(packageDir: string): Promise<Pkg | string> {
	const config = await getConfig()

	const packagePath = packageDir + '/package.json'
	const pkgJson = getFileJson(packagePath)
	if (!pkgJson) {
		return 'No package.json found at ' + packageDir
	}
	if (pkgJson.private && !config.allowPrivate) {
		return `Skipping private package: {magenta}${pkgJson.name}{/magenta}`
	}

	const should_publish = await shouldPublish(pkgJson, packageDir)
	if (!should_publish.results) {
		return `Package version matches published, git matches HEAD/Origin, skipping: {magenta}${pkgJson.name}{/magenta}\nTo force bump, use the --force flag`
	}

	return new Pkg(pkgJson, packageDir, should_publish)
}

export async function shouldPublish(pkg: PackageJson, packageDir: string): Promise<ShouldPublishResults> {
	const config = await getConfig()

	const npm_version = await npmVersion(pkg.name)
	const behindUpstream = await gitBehindUpstream(packageDir)

	return {
		results: !!((npm_version !== pkg.version || behindUpstream) || config.force),
		npm_version,
		behindUpstream
	}
}
