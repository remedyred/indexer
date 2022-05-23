import {$out, cleanDomain, finish, required, start, template} from '../helpers'
import {mkdir, saveFile} from '@snickbit/node-utilities'

export default async function (username?: string, domain?: string, site_name?: string) {
	username = await required('Username: ', username)
	domain = await required('Domain: ', domain)
	domain = cleanDomain(domain)
	site_name = await required('Site Name: ', site_name)

	$out.info('Starting Landing installation')

	const user_dir = `/home/${username}`
	const domain_dir = `${user_dir}/${domain}/`

	mkdir(domain_dir, {recursive: true})

	start('Generating landing page')
	saveFile(`${domain_dir}/index.php`, template('landing', {site_name}))
	finish('Generated landing page')
}
