/**
 * @fileoverview Custom ESLint rule: enforce consistent blank-line spacing
 * between JSDoc tags.
 *
 * Rules, looking only at the blank lines directly before each tag:
 * - two tags of the **same group** have NO blank line between them;
 * - two tags of **different groups** have EXACTLY ONE blank line between them;
 * - two **metadata** tags ({@link METADATA_TAGS}) have at most one: this
 *   repository writes declaration headers both ways — `@constant` / `@type` /
 *   `@description` together, and `@class` / `@extends`, a blank line, then
 *   `@description` — so the rule asks for neither.
 *
 * A tag's group is its name after synonyms (`@return` is `@returns`); the
 * metadata tags are one group.
 *
 * ```
 * CORRECT — same group, no blank; different groups, one blank:
 *   @param {string} a
 *   @param {string} b
 *
 *   @returns {string}
 *
 * CORRECT — metadata tags, with or without one blank line:
 *   @constant
 *   @type {string}
 *   @description The key prefix.
 *
 * WRONG — a blank between tags of the same group:
 *   @param {string} a
 *
 *   @param {string} b
 *
 * WRONG — no blank between tags of different groups:
 *   @returns {string}
 *   @throws {Error}
 * ```
 *
 * What it does not count, each of which the first version got wrong:
 * - a blank line inside a tag's description or `@example` code — only the run of
 *   blank lines right before the next tag separates two tags;
 * - a line that starts with `@` but is not a tag — a package name
 *   (`@scope/redis`) or a decorator (`@Injectable()`): a tag name is
 *   followed by a space, a `{` or the end of the line;
 * - anything inside a fenced code block.
 *
 * @rule custom/jsdoc-tag-spacing
 */

/**
 * Tags that describe the declaration rather than one part of it. They count as a
 * single group, and between two of them one blank line is optional: headers in
 * this repository are written both ways.
 *
 * @type {ReadonlySet<string>}
 */
const METADATA_TAGS = new Set([
  'abstract',
  'async',
  'class',
  'constant',
  'constructor',
  'description',
  'enum',
  'extends',
  'fileoverview',
  'function',
  'implements',
  'interface',
  'internal',
  'memberof',
  'method',
  'module',
  'name',
  'namespace',
  'override',
  'private',
  'protected',
  'public',
  'readonly',
  'static',
  'type',
  'typedef',
]);

/**
 * Synonyms JSDoc accepts for the same tag, mapped to the name used here. A `Map`,
 * not an object literal: looking `constructor` up on a plain object returns
 * `Object`'s own constructor, which put `@constructor` in a group of its own.
 *
 * @type {ReadonlyMap<string, string>}
 */
const TAG_ALIASES = new Map([
  ['arg', 'param'],
  ['argument', 'param'],
  ['augments', 'extends'],
  ['const', 'constant'],
  ['desc', 'description'],
  ['exception', 'throws'],
  ['func', 'function'],
  ['prop', 'property'],
  ['return', 'returns'],
]);

/**
 * A tag at the start of a comment line: `@name` followed by whitespace, `{` or
 * the end of the line, so `@scope/redis` and `@Injectable()` are not tags.
 *
 * @type {RegExp}
 */
const TAG_PATTERN = /^(?:\*\s*)?@([A-Za-z]\w*)(?=[\s{]|$)/;

/**
 * A fence that opens or closes a code block in a comment line.
 *
 * @type {RegExp}
 */
const FENCE_PATTERN = /^(?:\*\s*)?```/;

/**
 * Returns the group a tag belongs to: the metadata group, or its own name after
 * synonyms.
 *
 * @param {string} name - Tag name, without `@`.
 *
 * @returns {string} The group key.
 */
function groupOf(name) {
  const canonical = TAG_ALIASES.get(name) ?? name;

  return METADATA_TAGS.has(canonical) ? 'metadata' : canonical;
}

/**
 * Returns true when a JSDoc line carries no content: only an asterisk, or
 * nothing.
 *
 * @param {string} line - A raw line from the comment value.
 *
 * @returns {boolean} Whether the line is blank.
 */
function isBlankLine(line) {
  const trimmed = line.trim();

  return trimmed === '*' || trimmed === '';
}

/**
 * Finds every line of a comment that starts a tag, skipping fenced code.
 *
 * @param {string[]} lines - The comment value, split into lines.
 *
 * @returns {Array<{index: number, name: string, group: string}>} The tag lines, in order.
 */
function findTags(lines) {
  const tags = [];
  let inFence = false;

  for (let index = 0; index < lines.length; index++) {
    const trimmed = lines[index].trim();

    if (FENCE_PATTERN.test(trimmed)) {
      inFence = !inFence;
      continue;
    }

    const match = inFence ? null : trimmed.match(TAG_PATTERN);

    if (match) {
      tags.push({
        index,
        name: match[1],
        group: groupOf(match[1]),
      });
    }
  }

  return tags;
}

export default {
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    docs: {
      description:
        'Enforce no blank lines between JSDoc tags of the same group and exactly one between tags of different groups',
      recommended: false,
    },
    schema: [],
    messages: {
      noBlankSameType: 'No blank lines allowed between consecutive @{{from}} and @{{to}} tags.',
      missingBlankDiffType: 'A blank line is required between @{{from}} and @{{to}}.',
      extraBlankDiffType: 'Only one blank line is allowed between @{{from}} and @{{to}}.',
    },
  },

  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();

    return {
      Program() {
        for (const comment of sourceCode.getAllComments()) {
          if (comment.type !== 'Block' || !comment.value.startsWith('*')) {
            continue;
          }

          const lines = comment.value.split('\n');
          const tags = findTags(lines);

          if (tags.length < 2) {
            continue;
          }

          const toRemove = new Set();     // indices of blank lines to delete
          const toAddBefore = new Set();  // indices of tag lines that need a blank line before them

          /**
           * @type {Array<{messageId: string, data: Record<string, string>, lineIndex: number}>}
           */
          const violations = [];

          for (let position = 1; position < tags.length; position++) {
            const previous = tags[position - 1];
            const next = tags[position];

            // Only the run of blank lines right before the next tag separates the two;
            // a blank line inside a description or an `@example` is part of that text.
            const separator = [];

            for (let index = next.index - 1; index > previous.index && isBlankLine(lines[index]); index--) {
              separator.push(index);
            }

            const data = {
              from: previous.name,
              to: next.name,
            };

            if (previous.group === 'metadata' && next.group === 'metadata') {
              // Header tags: one blank line is optional, two are not.
              if (separator.length > 1) {
                violations.push({
                  messageId: 'extraBlankDiffType',
                  data,
                  lineIndex: next.index,
                });
                separator.slice(1).forEach((index) => toRemove.add(index));
              }
            } else if (previous.group === next.group) {
              if (separator.length > 0) {
                violations.push({
                  messageId: 'noBlankSameType',
                  data,
                  lineIndex: next.index,
                });
                separator.forEach((index) => toRemove.add(index));
              }
            } else if (separator.length === 0) {
              violations.push({
                messageId: 'missingBlankDiffType',
                data,
                lineIndex: next.index,
              });
              toAddBefore.add(next.index);
            } else if (separator.length > 1) {
              violations.push({
                messageId: 'extraBlankDiffType',
                data,
                lineIndex: next.index,
              });
              // `separator` runs upwards from the tag: keep the line nearest to it.
              separator.slice(1).forEach((index) => toRemove.add(index));
            }
          }

          if (violations.length === 0) {
            continue;
          }

          // One fixer rewrites the whole comment, so every violation in it is corrected in a
          // single pass; ESLint applies one of the identical fixes per run.
          const fix = (fixer) => {
            const result = [];

            for (let index = 0; index < lines.length; index++) {
              if (toRemove.has(index)) {
                continue;
              }

              if (toAddBefore.has(index)) {
                result.push(`${lines[index].match(/^(\s*)/)[1]}*`);
              }

              result.push(lines[index]);
            }

            return fixer.replaceTextRange(
              [
                comment.range[0],
                comment.range[1],
              ],
              `/*${result.join('\n')}*/`
            );
          };

          for (const violation of violations) {
            const line = comment.loc.start.line + violation.lineIndex;

            context.report({
              loc: {
                start: {
                  line,
                  column: 0,
                },
                end: {
                  line,
                  column: lines[violation.lineIndex].length,
                },
              },
              messageId: violation.messageId,
              data: violation.data,
              fix,
            });
          }
        }
      },
    };
  },
};
