import {execa} from 'execa'
import fs from 'fs'
import path from 'path'

export default function (plop) {
	// create your generators here
	plop.setGenerator('module', {
		description: 'Generate a new module',
		prompts: [
			{
				type: 'input',
				name: 'name',
				message: 'Package name: @remedyred/'
			},
			{
				type: 'confirm',
				name: 'typescript',
				message: 'Use TypeScript?',
				default: true
			}
		],
		actions: [
			{
				type: 'addMany',
				destination: '{{destination}}/{{name}}',
				base: '.templates/cli',
				templateFiles: '.templates/cli/**/*',
				force: true
			},
			async function renameFiles(answers, config, plop) {
				console.log('Renaming files...')
				const base = plop.getDestBasePath()

				const gitIgnore = path.join(base, '.gitignore.hbs')
				if (fs.existsSync(gitIgnore)) {
					fs.renameSync(gitIgnore, path.join(base, '.gitignore'))
				}
			},
			async function bootstrap(answers) {
				await execa('pnpm', ['install'])
			}
		]
	})
};
