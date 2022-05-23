import cli from '@snickbit/node-cli'
import landing from '../actions/landing'

export default async argv => cli(argv).args({
	username: {
		description: 'Username to create',
		type: 'string'
	},
	domain: {
		description: 'Domain to create',
		type: 'string'
	},
	site_name: {
		description: 'Name of the site to create',
		type: 'string'
	}
}).run(async (args) => landing(args.username as string, args.domain as string, args.site_name as string))
