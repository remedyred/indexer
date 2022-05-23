import cli from '@snickbit/node-cli'
import ftp from '../actions/ftp'

export default async argv => cli(argv).args({
	username: {
		description: 'Username to create',
		type: 'string'
	}
}).run(async args => ftp(args.username as string))
