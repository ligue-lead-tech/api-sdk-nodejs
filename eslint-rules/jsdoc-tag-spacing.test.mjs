/**
 * Tests for `custom/jsdoc-tag-spacing`, through ESLint's own `RuleTester`.
 *
 * The rule was registered for eight months without being switched on, and with
 * no test; turning it on meant reading it first, which found six ways
 * its fixer rewrote comments it should have left alone. Each of them has a case
 * below, so the next change cannot bring one back unnoticed.
 */

import { after, describe, it } from 'node:test';

import { RuleTester } from 'eslint';

import rule from './jsdoc-tag-spacing.mjs';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;
RuleTester.afterAll = after;

const ruleTester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

/**
 * Builds a JSDoc comment followed by a declaration, one comment line per item.
 *
 * @param {...string} lines - The comment lines, without the leading ` * `; an empty string is a blank line.
 *
 * @returns {string} Source code.
 */
function jsdoc(...lines) {
  const body = lines.map((line) => (line === '' ? ' *' : ` * ${line}`)).join('\n');

  return `/**\n${body}\n */\nexport const value = 1;\n`;
}

ruleTester.run('jsdoc-tag-spacing', rule, {
  valid: [
    {
      name: 'same tag together, a different tag after one blank line',
      code: jsdoc('Adds.', '', '@param {number} a - first', '@param {number} b - second', '', '@returns {number} sum'),
    },
    {
      name: 'metadata tags together, the compact header style',
      code: jsdoc('@constant', '@type {string}', '@description The key prefix.'),
    },
    {
      name: 'metadata tags with one blank line, the other header style',
      code: jsdoc('@class Gateway', '@extends BaseGateway', '', '@description Sends through the provider.'),
    },
    {
      name: '`@constructor` is a metadata tag, not `Object.prototype.constructor`',
      code: jsdoc('@constructor', '@description Builds it.'),
    },
    {
      name: '`@return` is `@returns`, so the two are one group',
      code: jsdoc('@returns {string} first', '@return {string} second'),
    },
    {
      name: 'a package name at the start of a line is not a tag',
      code: jsdoc('@param {string} key - the key', '@scope/redis owns the connection.'),
    },
    {
      name: 'a decorator inside an @example is not a tag',
      code: jsdoc('@example', '@Injectable()', 'class Service {}', '', '@returns {void}'),
    },
    {
      name: 'a blank line inside a description is part of the text',
      code: jsdoc('@param {string} a - first line', '', '  second paragraph of a', '@param {string} b - b'),
    },
    {
      name: 'blank lines inside @example code are part of the code',
      code: jsdoc('@example', 'const x = 1;', '', '', 'run(x);', '', '@returns {void}'),
    },
    {
      name: 'nothing inside a fenced code block is a tag',
      code: jsdoc('Usage:', '```', '@param {string} a', '', '@param {string} b', '```', '@returns {void}'),
    },
    {
      name: 'a block comment that is not JSDoc is ignored',
      code: '/*\n * @param {string} a\n *\n * @param {string} b\n */\nexport const value = 1;\n',
    },
  ],
  invalid: [
    {
      name: 'a blank line between two tags of the same group',
      code: jsdoc('@param {number} a - first', '', '@param {number} b - second'),
      output: jsdoc('@param {number} a - first', '@param {number} b - second'),
      errors: [
        {
          messageId: 'noBlankSameType',
          line: 4,
        },
      ],
    },
    {
      name: 'no blank line between tags of different groups',
      code: jsdoc('@returns {string} the value', '@throws {Error} when it fails'),
      output: jsdoc('@returns {string} the value', '', '@throws {Error} when it fails'),
      errors: [
        {
          messageId: 'missingBlankDiffType',
          line: 3,
        },
      ],
    },
    {
      name: 'the blank line goes before the next tag, not inside a multi-line description',
      code: jsdoc('@param {string} a - a description', '  that goes on here', '@returns {string} r'),
      output: jsdoc('@param {string} a - a description', '  that goes on here', '', '@returns {string} r'),
      errors: [
        {
          messageId: 'missingBlankDiffType',
          line: 4,
        },
      ],
    },
    {
      name: 'two blank lines between tags of different groups',
      code: jsdoc('@param {string} a - a', '', '', '@returns {string} r'),
      output: jsdoc('@param {string} a - a', '', '@returns {string} r'),
      errors: [
        {
          messageId: 'extraBlankDiffType',
          line: 5,
        },
      ],
    },
    {
      name: 'two blank lines between metadata tags',
      code: jsdoc('@class Gateway', '', '', '@description Sends.'),
      output: jsdoc('@class Gateway', '', '@description Sends.'),
      errors: [
        {
          messageId: 'extraBlankDiffType',
          line: 5,
        },
      ],
    },
    {
      name: 'every violation in one comment is fixed in a single pass',
      code: jsdoc('@param {string} a - a', '', '@param {string} b - b', '@returns {string} r'),
      output: jsdoc('@param {string} a - a', '@param {string} b - b', '', '@returns {string} r'),
      errors: [
        {
          messageId: 'noBlankSameType',
          line: 4,
        },
        {
          messageId: 'missingBlankDiffType',
          line: 5,
        },
      ],
    },
  ],
});
