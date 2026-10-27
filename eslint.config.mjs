/**
 * @fileoverview ESLint flat configuration of the SDK.
 *
 * The production rules (`src/`) follow the lint configuration of the LigueLead API's own code — sonarjs,
 * `@stylistic`, the custom layout rules under `eslint-rules/` and required JSDoc — so both read the same. On
 * top of them the SDK keeps what it already had: typescript-eslint `strict`, the brand-spelling guard
 * and one class per file.
 */

import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import jsdoc from 'eslint-plugin-jsdoc';
import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import blockMultilineRule from './eslint-rules/block-multiline.mjs';
import jsdocTagSpacingRule from './eslint-rules/jsdoc-tag-spacing.mjs';
import multilineIfConditionRule from './eslint-rules/multiline-if-condition.mjs';
import onePerLineRule from './eslint-rules/one-per-line.mjs';

/** Plain-Node rules for the tooling files, as in the API's own code. */
const toolingRules = {
  ...js.configs.recommended.rules,
  'no-var': 'error',
  'prefer-const': 'error',
  // `null: 'ignore'` keeps `x != null`, the deliberate idiom for "neither null nor undefined".
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  'no-eval': 'error',
};

export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
  },
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // `this: void` is how a method says it can be passed unbound (`raws.map(WebhookEvent.parse)`),
      // the idiom `@typescript-eslint/unbound-method` itself accepts; `void` stays refused elsewhere.
      '@typescript-eslint/no-invalid-void-type': ['error', { allowAsThisParameter: true, allowInGenericTypeArguments: true }],
      // One class per file, named after it (scripts/check-structure.mjs checks the names). A class
      // with only static members is how this codebase groups helpers, so it is allowed.
      'max-classes-per-file': ['error', 1],
      '@typescript-eslint/no-extraneous-class': ['error', { allowStaticOnly: true }],
      // The brand is spelled LigueLead. An identifier with the other spelling is a typo that
      // ends up in the public API, where renaming it later is a breaking change.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Identifier[name=/Liguelead/]',
          message: 'The brand is spelled "LigueLead", with a capital L in the middle.',
        },
      ],
    },
  },
  {
    // Production code: the same rules the LigueLead API applies to its own production code.
    files: ['src/**/*.ts'],
    settings: {
      jsdoc: { mode: 'typescript' },
    },
    plugins: {
      '@stylistic': stylistic,
      sonarjs,
      jsdoc,
      custom: {
        rules: {
          'multiline-if-condition': multilineIfConditionRule,
          'jsdoc-tag-spacing': jsdocTagSpacingRule,
          'one-per-line': onePerLineRule,
          'block-multiline': blockMultilineRule,
        },
      },
    },
    rules: {
      ...sonarjs.configs.recommended.rules,
      'sonarjs/todo-tag': 'off',
      // `?: T | undefined` is deliberate in the public types: a consumer compiling with
      // `exactOptionalPropertyTypes` can then pass `appId: process.env.X` (a `string | undefined`).
      'sonarjs/no-redundant-optional': 'off',
      'sonarjs/cognitive-complexity': ['warn', 15],
      '@stylistic/indent': [
        'error',
        2,
        {
          SwitchCase: 1,
          flatTernaryExpressions: false,
          offsetTernaryExpressions: true,
          ignoredNodes: [],
        },
      ],
      '@stylistic/object-curly-newline': [
        'error',
        {
          ObjectExpression: { multiline: true, consistent: true },
          ObjectPattern: { multiline: true, minProperties: 2 },
          TSTypeLiteral: { multiline: true, consistent: true },
          TSInterfaceBody: { multiline: true, consistent: true },
        },
      ],
      '@stylistic/padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: 'if' },
        { blankLine: 'always', prev: 'if', next: '*' },
        { blankLine: 'always', prev: '*', next: 'return' },
        { blankLine: 'always', prev: '*', next: ['break', 'continue', 'throw'] },
        { blankLine: 'always', prev: 'multiline-block-like', next: '*' },
        { blankLine: 'always', prev: '*', next: 'multiline-block-like' },
        { blankLine: 'always', prev: 'multiline-const', next: '*' },
        { blankLine: 'always', prev: '*', next: 'multiline-const' },
        { blankLine: 'always', prev: 'multiline-let', next: '*' },
        { blankLine: 'always', prev: '*', next: 'multiline-let' },
        { blankLine: 'always', prev: 'multiline-expression', next: '*' },
        { blankLine: 'always', prev: '*', next: 'multiline-expression' },
      ],
      '@stylistic/no-trailing-spaces': 'error',
      'id-length': ['error', { min: 2, properties: 'never', exceptions: ['T', 'K', 'V', 'U'] }],
      '@stylistic/no-multiple-empty-lines': ['error', { max: 1, maxBOF: 0, maxEOF: 0 }],
      '@stylistic/comma-dangle': ['error', 'always-multiline'],
      '@stylistic/max-len': [
        'error',
        {
          code: 120,
          tabWidth: 2,
          ignoreComments: true,
          ignoreUrls: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreRegExpLiterals: true,
        },
      ],
      '@stylistic/no-tabs': 'error',
      '@stylistic/eol-last': ['error', 'always'],
      '@stylistic/multiline-ternary': ['error', 'always'],
      '@stylistic/padded-blocks': ['error', 'never'],
      '@stylistic/lines-between-class-members': ['error', 'always'],
      curly: ['error', 'all'],
      'custom/one-per-line': 'error',
      '@stylistic/function-paren-newline': ['error', 'multiline-arguments'],
      'custom/block-multiline': 'error',
      'custom/multiline-if-condition': 'error',
      'custom/jsdoc-tag-spacing': 'error',
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: true,
          enableFixer: false,
          require: {
            FunctionDeclaration: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: true,
            FunctionExpression: false,
            MethodDefinition: true,
          },
        },
      ],
      'jsdoc/require-param': ['error', { enableFixer: false, checkDestructured: false }],
      'jsdoc/require-returns': ['error', { enableFixer: false }],
      'jsdoc/check-param-names': ['error', { checkDestructured: false, enableFixer: false }],
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      // Tests reach into response bodies and mocks typed as unknown on purpose.
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
  {
    files: ['**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      // `nodeBuiltin`, not `node`: `require`, `module` and `__dirname` do not exist in ESM.
      globals: { ...globals.es2021, ...globals.nodeBuiltin },
    },
    rules: toolingRules,
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.es2021, ...globals.node },
    },
    rules: toolingRules,
  },
  {
    // `node:test` injects its globals at run time.
    files: ['**/*.test.mjs'],
    languageOptions: {
      globals: { describe: 'readonly', it: 'readonly', before: 'readonly', after: 'readonly' },
    },
  },
);
