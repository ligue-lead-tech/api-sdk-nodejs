#!/usr/bin/env node
/**
 * @fileoverview Builds the public mirror commit of a release.
 *
 * The SDK is developed in a private repository and released to a public one, one commit per version.
 * This script turns a release of the private repository into that commit, in a clone of the public
 * repository. Everything is read from git objects at a ref (the released commit, or `HEAD`), never
 * from the working tree, so nothing a build step writes can reach the public repository:
 *
 * 1. every file at the ref must be classified by `public/mirror.json`: public (`include`), private
 *    (`exclude`) or part of the overlay (`overlay`, copied to the root of the public tree) — a file in
 *    none, or in more than one, or an overlay file landing on an included path, stops the release
 *    (landing on an excluded path is how a private file is replaced by its public version);
 * 2. only regular files are accepted, at plain paths: a symbolic link, a submodule, a `.git`, `..`,
 *    `.` or empty path segment, or a `.gitmodules` at the root, stops the release;
 * 3. Markdown links into the private repository become plain text (a parenthesized reference to one
 *    of its issues goes away entirely);
 * 4. the public tree is checked: no character outside a short allowed set (ASCII, Latin letters, some
 *    typography), so nothing can hide text from a reviewer; no `forbidden` string (the private
 *    repository's name included) or `forbiddenPatterns` match in any path or file — per line and
 *    across wrapped lines — and no binary file outside `binaryAllowed`;
 * 5. neither repository may have a version newer than this one; the target is validated first, and
 *    only once every check has passed is it emptied, filled, committed ("Release vX.Y.Z") and tagged.
 *
 * It never pushes: the caller does, so a failed check leaves the public repository untouched.
 *
 * Usage:
 *   node scripts/mirror-public.mjs --source <private repo> --tag vX.Y.Z --check [--ref <ref>]
 *   node scripts/mirror-public.mjs --source <private repo> --tag vX.Y.Z --target <public clone> [--ref <ref>]
 */

import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Who signs the mirror commits and tags — and nothing from the machine's git configuration: no
 * signing, and no hooks, so nothing in either repository runs while the mirror commits.
 */
const IDENTITY = [
  '-c', 'user.name=github-actions[bot]',
  '-c', 'user.email=github-actions[bot]@users.noreply.github.com',
  '-c', 'commit.gpgsign=false',
  '-c', 'tag.gpgsign=false',
  '-c', 'core.hooksPath=/dev/null',
];

/** The only git modes a release may carry: a regular file, executable or not. */
const REGULAR_MODES = new Set(['100644', '100755']);

/**
 * A map from characters, given by code point so that this file shows them as plain ASCII.
 *
 * @param {[number, string][]} pairs - Code point and value.
 *
 * @returns {Map<string, string>} The map.
 */
const byCodePoint = (pairs) => new Map(pairs.map(([code, value]) => [String.fromCodePoint(code), value]));

/**
 * The typography a public file may hold beyond ASCII, each with the ASCII it reads as: marks a
 * reviewer tells apart from ASCII, but that could still stand in for it inside a needle (an em dash
 * for a hyphen), so the forbidden check reads them as that ASCII too.
 */
const TYPOGRAPHY = byCodePoint([
  [0x2013, '-'], [0x2014, '-'], [0x2026, '...'], [0x2018, "'"], [0x2019, "'"], [0x201c, '"'],
  [0x201d, '"'], [0xab, '"'], [0xbb, '"'], [0x2022, '.'], [0xb0, 'o'], [0xd7, 'x'], [0x2190, '<-'],
  [0x2192, '->'], [0x20ac, 'eur'],
]);

/**
 * The Latin letters of U+00C0 to U+017F with no accent to strip, in lower case (the text is lowered
 * first), and the ASCII they read as.
 */
const PLAIN_LETTERS = byCodePoint([
  [0x131, 'i'], [0x138, 'k'], [0x142, 'l'], [0xf8, 'o'], [0x111, 'd'], [0xf0, 'd'], [0x127, 'h'],
  [0x167, 't'], [0x14b, 'n'], [0xe6, 'ae'], [0x153, 'oe'],
]);

/**
 * Latin letters of U+00C0 to U+017F refused all the same: the thorn and the sharp s look like a
 * different ASCII letter (`p`, `B`) than the one they stand for (`th`, `ss`), and the dotted capital
 * I lowers to two code points, which loses a word boundary after a token in both readings.
 */
const REFUSED_LETTERS = new Set([0xde, 0xfe, 0xdf, 0x130]);

/**
 * Whether a character of a public path or line is allowed: printable ASCII and the tab; the Latin
 * letters of U+00C0 to U+017F that are not compatibility forms nor `REFUSED_LETTERS`; and
 * `TYPOGRAPHY`. Anything else could hide or disguise text from whoever reviews it — a character that
 * renders as nothing, a combining mark, a control, another space or line break, a look-alike of an
 * ASCII letter, digit or punctuation mark, an emoji (one can spell a word, and joiners and selectors
 * are invisible) — and is refused outright, so that what is left reads as it is.
 *
 * @param {string} character - One code point.
 *
 * @returns {boolean} True when the character is allowed.
 */
const isAllowed = (character) => {
  const code = character.codePointAt(0);

  return code === 0x09
    || (code >= 0x20 && code <= 0x7e)
    || TYPOGRAPHY.has(character)
    || (code >= 0xc0
      && code <= 0x17f
      && !REFUSED_LETTERS.has(code)
      && /\p{L}/u.test(character)
      && character.normalize('NFKD') === character.normalize('NFD'));
};

/**
 * The first character of a path or line that `isAllowed` refuses.
 *
 * @param {string} text - A path, or a line without its line break (LF, or CRLF).
 *
 * @returns {string | undefined} The character, written as `U+XXXX`.
 */
const refusedIn = (text) => {
  const character = [...text].find((candidate) => !isAllowed(candidate));

  return character && `U+${character.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;
};

/**
 * The two readings of a text the forbidden check matches: lower-cased; and as ASCII — without
 * accents, and with each `PLAIN_LETTERS` letter and `TYPOGRAPHY` mark read as the ASCII it stands
 * for. The first is still needed: an accented letter next to a token reads as a word boundary,
 * which the second would lose.
 *
 * @param {string} text - A path or a file's text.
 *
 * @returns {string[]} The lower-cased text, then the ASCII one.
 */
const readingsOf = (text) => {
  const lower = text.toLowerCase();
  const ascii = [...lower.normalize('NFD').replace(/\p{M}/gu, '')]
    .map((character) => PLAIN_LETTERS.get(character) ?? TYPOGRAPHY.get(character) ?? character)
    .join('');

  return [lower, ascii];
};

/**
 * The numbers of a `vX.Y.Z` tag (no leading zeros, as in semver).
 *
 * @param {string} tag - A tag name.
 *
 * @returns {number[] | undefined} `[X, Y, Z]`, or nothing when the tag is not a version.
 */
const versionOf = (tag) => /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(tag)?.slice(1).map(Number);

/**
 * The tags of a list that name a version newer than a release. A release is never older than one
 * already out: the older tree would land on top of the public master (npm 11 itself refuses to
 * publish an older version as `latest`).
 *
 * @param {string[]} tags - Tag names; those that are not `vX.Y.Z` are ignored.
 * @param {string} tag - The release tag.
 *
 * @throws {Error} When the release tag is not `vX.Y.Z`.
 *
 * @returns {string[]} The newer tags, compared number by number (`v1.10.0` is newer than `v1.3.0`).
 */
export function newerTags(tags, tag) {
  const current = versionOf(tag);

  if (!current) {
    throw new Error(`${tag} is not vX.Y.Z.`);
  }

  return tags.filter((existing) => {
    const version = versionOf(existing);
    const index = version?.findIndex((part, position) => part !== current[position]) ?? -1;

    return index !== -1 && version[index] > current[index];
  });
}

/**
 * Throws when a repository already has a version newer than a release.
 *
 * @param {string} repository - A git repository.
 * @param {string} tag - The release tag.
 * @param {string} which - How the error names the repository.
 *
 * @throws {Error} When the release tag is not `vX.Y.Z`, or the repository has a newer one.
 */
function assertNotOlder(repository, tag, which) {
  const newer = newerTags(gitText(repository, 'tag', '--list', 'v*').split('\n'), tag);

  if (newer.length > 0) {
    throw new Error(`The ${which} already has ${newer.join(', ')}, newer than ${tag} — nothing was written. Release a newer version instead.`);
  }
}

const git = (cwd, args, options = {}) => execFileSync('git', [...IDENTITY, ...args], { cwd, maxBuffer: 64 * 1024 * 1024, ...options });
const gitText = (cwd, ...args) => git(cwd, args, { encoding: 'utf8' });

/**
 * Whether a path is covered by a list of `public/mirror.json`: an entry ending in `/` covers a whole
 * directory, any other entry one file.
 *
 * @param {string} path - A path relative to the repository root, with `/` separators.
 * @param {string[]} entries - A list of paths.
 *
 * @returns {boolean} True when an entry covers the path.
 */
export function matchesAny(path, entries) {
  return entries.some((entry) => (entry.endsWith('/')
    ? path.startsWith(entry)
    : path === entry));
}

/**
 * Turns Markdown links into the private repository into plain text. A parenthesized group of
 * references such as ` ([#40](…/issues/40), [#41](…/issues/41))` goes away entirely: the numbers mean
 * nothing in the public repository. When such a group opens a line, the line joins the one above —
 * unless that one is empty or a heading, so a paragraph never merges into a title.
 *
 * @param {string} text - Markdown.
 * @param {string} privateRepository - `owner/name` of the private repository.
 *
 * @returns {string} The text without links into the private repository.
 */
export function stripPrivateLinks(text, privateRepository) {
  const escaped = privateRepository.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const url = `https://github\\.com/${escaped}(?:[/#?][^)\\s]*)?`;
  const link = `\\[[^\\]\\r\\n]*\\]\\(${url}\\)`;
  const group = `\\(${link}(?:\\s*,\\s*${link})*\\)`;

  return text
    .replace(new RegExp(`([^\\r\\n]*)(\\r?\\n)[ \\t]*${group}[ \\t]*`, 'g'), (match, previous, newline, offset, whole) => {
      if (previous.trim() === '' || /^\s*#/.test(previous)) {
        return `${previous}${newline}`;
      }

      const next = whole[offset + match.length] ?? '';

      return /^[\s.,;:!?)]?$/.test(next)
        ? previous
        : `${previous} `;
    })
    .replace(new RegExp(` ?${group}`, 'g'), '')
    .replace(new RegExp(`\\[([^\\]\\r\\n]*)\\]\\(${url}\\)`, 'g'), '$1');
}

/**
 * The views of a whole text the forbidden check reads besides its lines, for each of its two
 * readings: with line breaks, the indentation around them and a leading comment or quote marker
 * (`*`, `//`, `#`, `>`) removed, so a needle wrapped across lines is still found; and then with `\/`
 * and `%2F` decoded. Every view is read in addition to the lines, never instead of them.
 *
 * @param {string} text - The text.
 *
 * @returns {{ view: string, ascii: boolean }[]} The views, and whether each comes from the ASCII
 *   reading.
 */
function viewsOf(text) {
  return readingsOf(text).flatMap((reading, index) => {
    const joined = reading.replace(/[ \t]*\r?\n[ \t]*(?:\*|\/\/|#|>)?[ \t]*/g, '');

    return [joined, joined.replace(/\\\//g, '/').replace(/%2f/g, '/')]
      .map((view) => ({ view, ascii: index === 1 }));
  });
}

/**
 * Checks a public tree before anything is written.
 *
 * @param {Map<string, { content: Buffer }>} files - The public tree, path → content.
 * @param {{ forbidden: string[], forbiddenPatterns?: string[], binaryAllowed?: string[], privateRepository?: string }} config -
 *   The lists of `public/mirror.json`; the private repository's name is always forbidden.
 *
 * @returns {string[]} One entry per problem: `path:line: needle`, `path: needle (across lines)`,
 *   `path: needle (in the path)` — each with `read as ASCII` when only the ASCII reading has it —,
 *   `path:line: U+XXXX, a character outside the allowed set`, `path: U+XXXX in the path, a character
 *   outside the allowed set` or `path: binary file`.
 */
export function findProblems(files, config) {
  const allNeedles = [
    ...config.forbidden,
    ...(config.privateRepository
      ? [config.privateRepository, config.privateRepository.split('/').pop()]
      : []),
  ].map((needle) => needle.toLowerCase());
  const needles = [...new Set(allNeedles)];
  const patterns = [...new Set(config.forbiddenPatterns ?? [])].map((source) => ({ source, regex: new RegExp(source, 'i') }));
  const binaryAllowed = config.binaryAllowed ?? [];
  const problems = [];

  const matchesIn = (text) => [
    ...needles.filter((needle) => text.includes(needle)),
    ...patterns.filter(({ regex }) => regex.test(text)).map(({ source }) => `/${source}/`),
  ];
  // Each hit once, and whether only the ASCII reading found it: the message then says so, since the
  // line as written does not show the needle.
  const hitsIn = (text) => {
    const [lower, ascii] = readingsOf(text).map(matchesIn);

    return [
      ...lower.map((hit) => ({ hit, ascii: false })),
      ...ascii.filter((hit) => !lower.includes(hit)).map((hit) => ({ hit, ascii: true })),
    ];
  };
  const readAs = (ascii) => (ascii
    ? ', read as ASCII'
    : '');

  for (const [path, { content }] of files) {
    const refused = refusedIn(path);

    if (refused) {
      problems.push(`${path}: ${refused} in the path, a character outside the allowed set`);
    }

    for (const { hit, ascii } of hitsIn(path)) {
      problems.push(`${path}: ${hit} (in the path${readAs(ascii)})`);
    }

    // A NUL byte, or a UTF-16 byte order mark, is a file the text check cannot read.
    const binary = content.includes(0) || (content[0] === 0xff && content[1] === 0xfe) || (content[0] === 0xfe && content[1] === 0xff);

    if (binary) {
      if (!matchesAny(path, binaryAllowed)) {
        problems.push(`${path}: binary file`);
      }

      continue;
    }

    const text = content.toString('utf8');
    const found = new Set();
    const lines = text.split('\n');

    lines.forEach((line, index) => {
      // A `\r` is allowed only where it ends a line (`\r\n`), never at the end of the file.
      const refusedInLine = refusedIn(index < lines.length - 1
        ? line.replace(/\r$/, '')
        : line);

      if (refusedInLine) {
        problems.push(`${path}:${index + 1}: ${refusedInLine}, a character outside the allowed set`);
      }

      for (const { hit, ascii } of hitsIn(line)) {
        problems.push(`${path}:${index + 1}: ${hit}${ascii
          ? ' (read as ASCII)'
          : ''}`);
        found.add(hit);
      }
    });

    for (const { view, ascii } of viewsOf(text)) {
      for (const hit of matchesIn(view)) {
        if (!found.has(hit)) {
          problems.push(`${path}: ${hit} (across lines${readAs(ascii)})`);
          found.add(hit);
        }
      }
    }
  }

  return problems;
}

/**
 * Builds the public tree of a release from git objects, and checks it.
 *
 * @param {{ source: string, tag: string, ref?: string }} options - The private repository, the release
 *   tag and the commit to read (`HEAD` by default; the release workflow passes the released commit).
 *
 * @throws {Error} When the tag does not match `package.json` or is not `vX.Y.Z`, or the source has a
 *   newer version; a file is unclassified, in more than one list, an overlay file landing on an
 *   included path, not a regular file or at an unsafe path; or the public tree has a problem.
 *
 * @returns {Map<string, { content: Buffer, mode: string }>} The public tree, path → content and mode.
 */
export function buildRelease({ source, tag, ref = 'HEAD' }) {
  const show = (path) => gitText(source, 'show', `${ref}:${path}`);
  const config = JSON.parse(show('public/mirror.json'));
  const { version } = JSON.parse(show('package.json'));

  if (typeof version !== 'string' || tag !== `v${version}`) {
    throw new Error(`The tag ${tag} does not match package.json (${JSON.stringify(version)}) at ${ref}.`);
  }

  // Checked here, so the dry run stops an older version before the release workflow tags it.
  assertNotOlder(source, tag, 'source');

  const overlay = config.overlay.endsWith('/')
    ? config.overlay
    : `${config.overlay}/`;
  const entries = gitText(source, 'ls-tree', '-r', '-z', '--full-tree', ref).split('\0').filter(Boolean)
    .map((line) => {
      // The path is everything after the first tab: with -z, git does not quote it.
      const tab = line.indexOf('\t');
      const [mode, , object] = line.slice(0, tab).split(' ');

      return { mode, object, path: line.slice(tab + 1) };
    });

  const problems = [];

  for (const { mode, path } of entries) {
    const destinations = [
      matchesAny(path, config.include),
      matchesAny(path, config.exclude),
      path.startsWith(overlay),
    ].filter(Boolean).length;

    if (destinations === 0) {
      problems.push(`${path}: in none of \`include\`, \`exclude\` or the overlay`);
    } else if (destinations > 1) {
      problems.push(`${path}: in more than one of \`include\`, \`exclude\` and the overlay`);
    }

    if (!REGULAR_MODES.has(mode)) {
      problems.push(`${path}: mode ${mode} — only regular files are mirrored (no symbolic links, no submodules)`);
    }

    // Checked where the file would land in the public tree, too: the overlay moves it to the root.
    const landing = path.startsWith(overlay)
      ? path.slice(overlay.length)
      : path;
    const unsafe = (candidate) => candidate.toLowerCase() === '.gitmodules'
      || candidate.split('/').some((segment) => ['.git', '..', '.', ''].includes(segment.toLowerCase()));

    if (unsafe(path) || unsafe(landing)) {
      problems.push(`${path}: a .git, .., ., empty or .gitmodules path cannot be mirrored`);
    }

    // The overlay may take the place of a private file (the private `publish.yml` gives way to the
    // public one), but never of a public one: which of the two would be published is then ambiguous.
    if (path.startsWith(overlay) && matchesAny(path.slice(overlay.length), config.include)) {
      problems.push(`${path}: the overlay would land on ${path.slice(overlay.length)}, which is in \`include\``);
    }
  }

  if (problems.length > 0) {
    throw new Error(`public/mirror.json does not account for the tree at ${ref} — nothing was written:\n${problems.join('\n')}`);
  }

  const files = new Map();

  for (const { mode, object, path } of entries) {
    if (matchesAny(path, config.exclude)) {
      continue;
    }

    const target = path.startsWith(overlay)
      ? path.slice(overlay.length)
      : path;
    let content = git(source, ['cat-file', 'blob', object]);

    if (target.endsWith('.md')) {
      content = Buffer.from(stripPrivateLinks(content.toString('utf8'), config.privateRepository));
    }

    files.set(target, { content, mode });
  }

  const found = findProblems(files, config);

  if (found.length > 0) {
    throw new Error(`Problems in the public tree — nothing was written:\n${found.join('\n')}`);
  }

  return files;
}

/**
 * Checks that a directory is the root of its own git repository, and not the source.
 *
 * @param {string} target - The public clone.
 * @param {string} source - The private repository.
 *
 * @throws {Error} When the target is not a repository root, or is the source.
 */
function assertTarget(target, source) {
  const real = realpathSync(target);
  let top;

  try {
    top = realpathSync(gitText(target, 'rev-parse', '--show-toplevel').trim());
  } catch {
    throw new Error(`${target} is not a git repository.`);
  }

  if (top !== real) {
    throw new Error(`${target} is not the root of a git repository (the root is ${top}).`);
  }

  if (real === realpathSync(gitText(source, 'rev-parse', '--show-toplevel').trim())) {
    throw new Error('The target is the source repository.');
  }
}

/**
 * Builds, commits and tags the mirror of a release in a clone of the public repository.
 *
 * @param {{ source: string, target: string, tag: string, ref?: string }} options - The private
 *   repository, a clone of the public one (possibly empty), the release tag and the ref to read.
 *
 * @throws {Error} When the target is not the root of another repository; the tag is not `vX.Y.Z`;
 *   the target has a newer version; `buildRelease` refuses the source or the tree; a file would land
 *   outside the target's tree; or the target did not stage every file.
 *
 * @returns {{ status: 'committed' | 'exists', files?: number }} `exists` when the target already has
 *   the tag, which makes a re-run harmless.
 */
export function mirror({ source, target, tag, ref = 'HEAD' }) {
  assertTarget(target, source);

  if (gitText(target, 'tag', '--list', tag).trim() !== '') {
    return { status: 'exists' };
  }

  // Never backwards — re-running an old release's mirror after a newer one went out.
  assertNotOlder(target, tag, 'target');

  const files = buildRelease({ source, tag, ref });

  for (const path of files.keys()) {
    const to = resolve(target, path);
    const [first] = relative(target, to).split(sep);

    if (first === '..' || first.toLowerCase() === '.git') {
      throw new Error(`${path} would be written outside the target's tree — nothing was written.`);
    }
  }

  // The mirror is the release, whole: what the previous release had and this one dropped goes away.
  for (const entry of readdirSync(target)) {
    if (entry !== '.git') {
      rmSync(join(target, entry), { recursive: true, force: true });
    }
  }

  for (const [path, { content, mode }] of files) {
    const to = resolve(target, path);

    mkdirSync(dirname(to), { recursive: true });
    writeFileSync(to, content);
    chmodSync(to, mode === '100755'
      ? 0o755
      : 0o644);
  }

  // `--force`: the public `.gitignore` must not silently leave a release file out.
  git(target, ['add', '--all', '--force']);

  const staged = gitText(target, 'ls-files', '-z').split('\0').filter(Boolean).length;

  if (staged !== files.size) {
    throw new Error(`${staged} files staged in the target, ${files.size} expected — nothing was committed.`);
  }

  git(target, ['commit', '--quiet', '--allow-empty', '-m', `Release ${tag}`]);
  git(target, ['tag', '--annotate', tag, '-m', `Release ${tag}`]);

  return { status: 'committed', files: files.size };
}

/**
 * Reads `--name value` pairs, and the `--check` flag, from the command line.
 *
 * @param {string[]} argv - The arguments after the script path.
 *
 * @throws {Error} When a name has no value, or a value has no name.
 *
 * @returns {Record<string, string | boolean>} The options.
 */
export function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index++) {
    const name = argv[index];

    if (name === '--check') {
      options.check = true;
      continue;
    }

    const value = argv[index + 1];

    if (!name.startsWith('--') || value === undefined || value.startsWith('--')) {
      throw new Error(`Expected --name value pairs (and --check), got "${argv.slice(index).join(' ')}".`);
    }

    options[name.slice(2)] = value;
    index++;
  }

  return options;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { source, target, tag, ref, check } = parseArgs(process.argv.slice(2));

  if (!source || !tag || (!check && !target)) {
    console.error('Usage: node scripts/mirror-public.mjs --source <dir> --tag vX.Y.Z (--check | --target <dir>) [--ref <ref>]');
    process.exit(2);
  }

  if (check) {
    const files = buildRelease({ source, tag, ref });

    console.log(`${tag}: the public tree is valid (${files.size} files).`);
  } else {
    const result = mirror({ source, target, tag, ref });

    console.log(result.status === 'exists'
      ? `${tag} is already in the public repository — nothing to do.`
      : `${tag} committed and tagged in the public clone (${result.files} files).`);
  }
}
