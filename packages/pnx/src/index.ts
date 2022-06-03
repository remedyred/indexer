#!/usr/bin/env node

import {out} from '@snickbit/out'
import cli from '@snickbit/node-cli'
import packageJson from '../package.json'

cli()
	.name('@remedyred/pnx')
	.version(packageJson.version)
	.run().then(async (/* argv */) => {
		out.info('Hello, world!')
		out.done('Done!')
	})
	.catch(err => out.fatal('Error:', err))