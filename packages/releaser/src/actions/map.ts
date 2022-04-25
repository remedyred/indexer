import mapWorkspaces from '@npmcli/map-workspaces'


export default async function (args) {
	const map: Map<string, string> = await mapWorkspaces({
		pkg: packageJSON,
		cwd
	})
	return map
}
