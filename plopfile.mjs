import {execa} from 'execa'

/**
 * @param {Plop} plop
 */
export default function (plop) {
	// create your generators here
	plop.setGenerator('module', {
		description: 'Generate a new module',
		prompts: [
			{
				type: 'input',
				name: 'name',
				message: 'Package name: @snickbit/'
			},
			{
				type: 'confirm',
				name: 'typescript',
				message: 'Use TypeScript?',
				default: true
			}
		],
		actions: [
			/**
			 * @param {PlopAnswers} answers
			 * @returns {Promise<string>}
			 */
			async function checkAnswers(answers) {
				console.log('checking answers')
				answers.destination = `packages/${answers.name}`
				answers.ext = answers.typescript ? 'ts' : 'js'
				return 'Ready to add files'
			},
			{
				type: 'add',
				path: '{{destination}}/typedoc.json',
				templateFile: '.templates/typedoc.json.hbs',

				/**
				 * @param {PlopAnswers} answers
				 */
				skip: answers => !answers.typescript ? 'Skipping TypeDoc configuration for non-TypeScript project' : null
			},
			{
				type: 'add',
				path: '{{destination}}/package.json',
				templateFile: '.templates/package.json.hbs'
			},
			{
				type: 'add',
				path: '{{destination}}/tsconfig.json',
				templateFile: '.templates/tsconfig.json.hbs'
			},
			{
				type: 'add',
				path: '{{destination}}/src/index.{{ext}}',
				templateFile: '.templates/src/index.ts.hbs'
			},
			async function bootstrap(answers) {
				console.log('Bootstrapping')

				const options = {
					cwd: process.cwd() + '/packages/' + answers.name,
					stdio: 'inherit'
				}

				console.log('Updating first party package versions in package.json')
				await execa('pnpx', ['npm-check-updates', '--upgrade', '--target=newest', '--filter', '@snickbit/*,@remedyred/*'], options).catch(() => console.error('Failed to update first party packages'))

				options.cwd = process.cwd()

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
