/**
 * Make ignore array
 */
export function makeIgnore(conf) {
	const ignore = [conf.output, '**/*.d.ts']
	if (conf.ignore) {
		ignore.push(...conf.ignore)
	}
	return ignore.filter(Boolean)
}
