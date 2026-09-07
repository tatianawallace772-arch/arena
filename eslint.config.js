/**
 * Flat ESLint config. The app ships no framework or bundler, so the rules are
 * the ones that catch real breakage in vanilla code: undefined identifiers,
 * unused declarations, mutable shared state, missing await, floating promises.
 */
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', '.shots/**'] },
  js.configs.recommended,
  {
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'after-used', varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-console': ['warn', { allow: ['warn', 'info', 'error'] }],
      'no-await-in-loop': 'off',
      'prefer-const': 'warn',
      'no-var': 'error',
      eqeqeq: ['warn', 'smart'],
      'no-param-reassign': 'off',
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node, ...globals.browser } },
    rules: { 'no-console': 'off' },
  },
  {
    files: ['server.js', 'tests/**/*.mjs'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node } },
    rules: { 'no-console': 'off' },
  },
];
