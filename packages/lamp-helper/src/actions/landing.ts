import {mkdir, saveFile} from '@snickbit/node-utilities'
import {$out, cleanDomain} from '../helpers'
import {finish, start} from '../spinner'
import {required} from '../prompt'
import {template} from '../template'

export default async function () {
	const username = await required('username')
	const domain = cleanDomain(await required('domain'))
	const site_name = await required('site_name')

	$out.info('Starting Landing installation')

	const user_dir = `/home/${username}`
	const domain_dir = `${user_dir}/www/${domain}/`

	mkdir(domain_dir, {recursive: true})

	start('Generating landing page')
	saveFile(`${domain_dir}/index.php`, template('landing', {site_name}))
	finish('Generated landing page')
}
