import {defineConfig} from 'tsup'

export default defineConfig({
	entry: ['src/index.ts', 'src/cli.ts'],
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
