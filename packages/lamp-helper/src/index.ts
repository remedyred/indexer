#!/usr/bin/env node

import {out} from '@snickbit/out'
import * as commands from './commands'
import cli from '@snickbit/node-cli'
import packageJson from '../package.json'

cli()
	.name('lamp-helper')
	.version(packageJson.version)
	.actions(commands)
	.run().then(async (/* argv */) => out.done('Done!'))
	.catch(err => out.fatal('Error:', err))
