import {exTrim} from './commands'

export async function isGitClean(directory: string): Promise<string> {
	return exTrim('git', ['status', '--porcelain'], directory)
}

export async function gitBranch(directory: string): Promise<string> {
	return exTrim('git', ['rev-parse', '--abbrev-ref', 'HEAD'], directory)
}

export async function gitBehindUpstream(directory: string, branch = 'main'): Promise<string> {
	return exTrim('git', [
		'rev-list',
		'--left-right',
		'--count',
		`origin/${branch}..HEAD`
	], directory)
}

export async function gitPush(directory: string, branch: string): Promise<string> {
	return exTrim('git', [
		'push',
		'origin',
		branch,
		'--follow-tags'
	], directory)
}

export async function gitCommit(directory: string, commitMessage: string): Promise<string> {
	return exTrim('git', ['commit', '--message', commitMessage], directory)
}

export async function gitAdd(directory: string, ...paths: string[]): Promise<string> {
	return exTrim('git', ['add', ...paths], directory)
}

export async function gitTag(directory: string, tagName: string, tagMessage: string): Promise<string> {
	return exTrim('git', [
		'tag',
		'--annotate',
		'--message',
		tagMessage,
		tagName
	], directory)
}

export async function gitRepoPath(directory: string): Promise<string> {
	return exTrim('git', ['rev-parse', '--show-toplevel'], directory)
}

export async function gitLog(directory: string, tagName: string, gitRelativePath: string): Promise<string> {
	return exTrim('git', [
		'log',
		'--pretty=format:"* %s (%h)"',
		`${tagName}..HEAD`,
		'--',
		gitRelativePath || '.'
	], directory)
}

export async function gitUrl(directory: string) {
	return exTrim('git', ['config', '--get', 'remote.origin.url'], directory)
}
