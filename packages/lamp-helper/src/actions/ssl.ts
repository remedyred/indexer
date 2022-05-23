import {$out, cleanDomain, finish, required, run, start} from '../helpers'
import {config} from '../config'

export default async function (domain?: string) {
	domain = await required('Domain: ', domain)
	domain = cleanDomain(domain)

	$out.info('Starting SSL certificate creation')

	start('Creating SSL certificate for ' + domain)
	await run('certbot', '--apache', '--agree-tos', '--non-interactive', '--email', await config('admin.email'), '-d', domain, '-d', 'www.' + domain)
	finish('Created SSL certificate for ' + domain)
}
