import {defineConfig} from 'tsup'

export default defineConfig({
	// bundle: false,
	entry: [
		'src/index.ts',
		'src/cli.ts',
		'src/esbuild.ts'
	],
	clean: true,
	dts: true,
	splitting: false,
	format: ['esm'],
	external: [],
	outDir: './dist',
	outExtension() {
		return {js: '.js'}
	}
})
