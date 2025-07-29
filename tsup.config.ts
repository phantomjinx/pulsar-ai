import { defineConfig, Options } from 'tsup'

export default defineConfig((options: Options) => ({
  entry: ['lib/main.ts'],
  format: ['cjs'],
  external: ['pulsar'],
  outDir: 'dist',
  clean: true,

  // This option is only used when the --watch flag is passed
  ignoreWatch: [
    '**/*.test.ts',
    'jest.config.ts',
    '**/.jest-cache/**',
    '**/node_modules/**',
    '**/dist/**',
  ],

  // Conditionally set options based on the mode
  sourcemap: !!options.watch, // Create sourcemaps only for 'dev'
  minify: !options.watch,     // Minify the code only for 'build'
}))
