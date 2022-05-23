import {$out, cleanDomain, finish, required, start, template} from '../helpers'
import {mkdir, saveFile} from '@snickbit/node-utilities'

export default async function () {
	const username = await required('username')
	const domain = cleanDomain(await required('domain'))
	const site_name = await required('site.name')

	$out.info('Starting Landing installation')

	const user_dir = `/home/${username}`
	const domain_dir = `${user_dir}/${domain}/`

	mkdir(domain_dir, {recursive: true})

	start('Generating landing page')
	saveFile(`${domain_dir}/index.php`, template('landing', {site_name}))
	finish('Generated landing page')
}
