import {execa, execaCommand} from 'execa'
import {interpolate, isEmpty, isObject, objectExcept} from '@snickbit/utilities'
import {$out, awaitProcesses, getConfig, maxProcesses, PackageJson, processes, ReleaseName, releases} from './config'
import {getFileJson, progress, saveFileJson} from '@snickbit/node-utilities'
import fg from 'fast-glob'

async function exTrim(cmd: string, args: string[], directory?: string) {
	let results

	try {
		results = await execa(cmd, args, {cwd: directory})
	} catch (e) {
		results = {stdout: '', stderr: ''}
	}

	return results.stdout.trim()
}

async function isGitClean(directory: string): Promise<string> {
	return exTrim('git', ['status', '--porcelain'], directory)
}

async function gitBranch(directory: string): Promise<string> {
	return exTrim('git', ['rev-parse', '--abbrev-ref', 'HEAD'], directory)
}

async function gitCanPush(directory: string, branch = 'main'): Promise<string> {
	return exTrim('git', ['diff', `origin/${branch}..HEAD`], directory)
}

async function npmVersion(packageName: string): Promise<string> {
	return exTrim('npm', ['show', packageName, 'version'])
}

export async function shouldPublish(pkg: PackageJson, packageDir: string) {
	const config = await getConfig()

	const npm_version = await npmVersion(pkg.name)
	const canPush = await gitCanPush(packageDir)

	return {
		results: (npm_version !== pkg.version || canPush) || config.force,
		npm_version,
		canPush
	}
}

export async function findPackages(workspaces: string[]): Promise<PackageJson[]> {
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
	const results: PackageJson[] = []

	for (let fileDir of files) {
		if (processes.length >= maxProcesses) await awaitProcesses()
		processes.push(loadPackage(fileDir).then((pkg: PackageJson | string) => {
			if (isObject(pkg)) {
				results.push(pkg as PackageJson)
			} else {
				warnings.push(pkg as string)
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

async function loadPackage(packageDir: string): Promise<PackageJson | string> {
	const config = await getConfig()

	const packagePath = packageDir + '/package.json'
	const pkg = getFileJson(packagePath)
	if (!pkg) {
		return 'No package.json found at ' + packageDir
	}
	if (pkg.private && !config.allowPrivate) {
		return `Skipping private package: {magenta}${pkg.name}{/magenta}`
	}

	const should_publish = await shouldPublish(pkg, packageDir)
	if (!should_publish.results) {
		return `Package version matches published, git matches HEAD/Origin, skipping: {magenta}${pkg.name}{/magenta}\nTo force bump, use the --force flag`
	}

	pkg.dir = packageDir
	pkg.path = packagePath
	pkg.npm_version = should_publish.npm_version

	return pkg
}

export async function bumpPackage(release: ReleaseName) {
	const {name, bump, version, pkg, dryRun, out} = releases[release]
	const config = await getConfig()

	const {scripts} = pkg

	releases[release].branch = await gitBranch(pkg.dir)

	out.debug('Checking working tree')
	const status = await isGitClean(pkg.dir)
	if (status.length) {
		out.force.error(`Working tree is dirty, skipping release for {cyan}${name}{/cyan}`)
		out.force.broken.error(...status.split('\n'))
		return
	}

	if (scripts?.prerelease) {
		out.info(`Running prerelease script`)
		if (dryRun) {
			out.force.warn(`DRY RUN: ${scripts.prerelease}`)
		} else {
			await execaCommand(scripts.prerelease, {cwd: pkg.dir})
		}
	}

	out.info(`Bumping version to {magenta}${version}{/magenta}`)
	pkg.version = version
	if (dryRun) {
		out.force.warn(`DRY RUN: bumping ${pkg.name}@${pkg.version}`)
	} else {
		saveFileJson(pkg.path, objectExcept(pkg, ['dir', 'path', 'npm_version']))
	}

	out.debug('Adding changes')
	if (dryRun) {
		out.force.warn(`DRY RUN: git add ${pkg.path}`)
	} else {
		await execa('git', ['add', pkg.path], {cwd: pkg.dir})
	}

	out.info('Committing changes')

	const commitMessage = interpolate(config.commitMessage, {
		name,
		version,
		bump
	})

	if (dryRun) {
		out.force.warn(`DRY RUN: git commit --message "${commitMessage}"`)
	} else {
		await execa('git', ['commit', '--message', commitMessage], {cwd: pkg.dir})
	}

	out.debug('Tagging release')

	const tagMessage = interpolate(config.tagMessage, {
		name,
		version,
		bump
	})

	const tagName = interpolate(config.tagName, {
		name,
		version,
		bump
	})

	if (dryRun) {
		out.force.warn(`DRY RUN: git tag --annotate --message="${tagMessage}" ${tagName}`)
	} else {
		await execa('git', ['tag', '--annotate', '--message', tagMessage, tagName], {cwd: pkg.dir})
	}

	out.info('Marking to be pushed and published')
	releases[release].pushReady = true
}

export async function pushRelease(release: ReleaseName) {
	const {pkg, dryRun, out, branch} = releases[release]

	out.debug('Pushing changes')
	if (dryRun) {
		out.force.warn(`DRY RUN: git push origin --follow-tags`)
	} else {
		const status = await gitCanPush(pkg.dir, branch)
		if (!status.length) {
			out.debug('Nothing to push, skipping')
			return
		}

		await execa('git', ['push', 'origin', branch, '--follow-tags'], {cwd: pkg.dir})

		releases[release].publishReady = true
	}
}

export async function publishRelease(release: ReleaseName) {
	const {dryRun, out, pkg} = releases[release]
	const {scripts} = pkg
	const config = await getConfig()

	if (scripts?.prepublish) {
		out.info(`Running prepublish script`)

		if (dryRun) {
			out.force.warn(`DRY RUN: ${scripts.prepublish}`)
		} else {
			await execaCommand(scripts.prepublish, {cwd: pkg.dir})
		}
	}

	out.info('Publishing package')

	const npmPublishArgs = [
		'publish',
		'--ignore-scripts',
		`--access=${config.access}`
	]

	if (dryRun) {
		npmPublishArgs.push('--dry-run')
	}

	if (config.otp) {
		npmPublishArgs.push(`--otp=${config.otp}`)
	}

	try {
		await execa('npm', npmPublishArgs, {cwd: pkg.dir, stdout: 'inherit'})
	} catch (e) {
		$out.error('Publishing failed', e.message)
	}

	if (scripts?.postpublish) {
		out.info(`Running postpublish script`)
		if (dryRun) {
			out.force.warn(`DRY RUN: ${scripts.postpublish}`)
		} else {
			await execaCommand(scripts.postpublish, {cwd: pkg.dir})
		}
	}
}
