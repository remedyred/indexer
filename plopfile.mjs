import {execa} from 'execa'

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
				destination: 'packages/{{name}}',
				base: '.templates/cli',
				templateFiles: '.templates/cli/**/*',
				force: true
			},
			async function bootstrap() {
				console.log('Bootstrapping')

				const options = {cwd: process.cwd()}

				/**
				 * @type {Promise<any>[]}
				 */
				const tasks = [
					execa('pnpm', ['install'], options).catch(() => console.warn('Failed to install dependencies')),
					execa('pnpm', ['eslint', '.', '--quiet', '--fix'], options).catch(() => console.warn('Failed to install dependencies'))
				]

				await Promise.all(tasks)
				return 'Bootstrap Complete'
			}
		]
	})
};
