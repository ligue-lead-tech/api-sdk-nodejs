import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, describe, it } from 'node:test';
import { buildRelease, findProblems, matchesAny, mirror, newerTags, parseArgs, stripPrivateLinks } from './mirror-public.mjs';

const PRIVATE = 'acme/private-sdk';
const IDENTITY = ['-c', 'user.name=test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null'];
const git = (cwd, ...args) => execFileSync('git', [...IDENTITY, ...args], { cwd, encoding: 'utf8' });

const roots = [];

const tempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'mirror-test-'));

  roots.push(dir);

  return dir;
};

const write = (root, path, content) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
};

const CONFIG = {
  privateRepository: PRIVATE,
  overlay: 'public/files/',
  include: ['package.json', 'src/', 'CHANGELOG.md', '.github/workflows/ci.yml', 'bin/', '.gitignore'],
  exclude: ['.github/workflows/internal.yml', 'MAINTAINING.md', 'public/mirror.json'],
  forbidden: ['top-secret'],
  forbiddenPatterns: ['github\\.com[/:]acme/(?!public-sdk\\b)', '\\bnpm_[a-z0-9]{36}\\b'],
  binaryAllowed: [],
};

/**
 * A private repository with internal files, an overlay and links into itself, committed.
 *
 * @param {Record<string, string | Buffer>} [files] - Extra files, or replacements.
 * @param {object} [config] - Overrides for `public/mirror.json`.
 *
 * @returns {string} The repository.
 */
const makeSource = (files = {}, config = {}) => {
  const source = tempDir();

  git(source, 'init', '--quiet', '-b', 'master');
  write(source, 'package.json', JSON.stringify({ name: '@acme/sdk', version: '1.3.0' }));
  write(source, 'src/index.ts', 'export const answer = 42;\n');
  write(source, 'CHANGELOG.md', `- Added a thing ([#7](https://github.com/${PRIVATE}/issues/7)).\n`);
  write(source, '.github/workflows/ci.yml', 'name: CI\n');
  write(source, '.github/workflows/internal.yml', 'name: Internal\n');
  write(source, 'MAINTAINING.md', 'internal notes\n');
  write(source, 'public/files/CONTRIBUTING.md', 'Contributions welcome.\n');
  write(source, 'public/files/.github/workflows/publish.yml', 'name: Publish\n');
  write(source, 'public/mirror.json', JSON.stringify({ ...CONFIG, ...config }));

  for (const [path, content] of Object.entries(files)) {
    write(source, path, content);
  }

  git(source, 'add', '--all', '--force');
  git(source, 'commit', '--quiet', '-m', 'release');

  return source;
};

const makeTarget = () => {
  const target = tempDir();

  git(target, 'init', '--quiet', '-b', 'master');

  return target;
};

after(() => {
  for (const dir of roots) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('matchesAny', () => {
  it('matches a file exactly and a directory by its trailing slash', () => {
    const entries = ['MAINTAINING.md', 'public/'];

    assert.equal(matchesAny('MAINTAINING.md', entries), true);
    assert.equal(matchesAny('public/files/CONTRIBUTING.md', entries), true);
    assert.equal(matchesAny('docs/MAINTAINING.md', entries), false);
    assert.equal(matchesAny('publicity.md', entries), false);
  });
});

describe('parseArgs', () => {
  it('reads --name value pairs and the --check flag', () => {
    assert.deepEqual(parseArgs(['--source', '.', '--check', '--tag', 'v1.0.0']), { source: '.', check: true, tag: 'v1.0.0' });
  });

  it('refuses a name without a value instead of shifting the next ones', () => {
    assert.throws(() => parseArgs(['--source', '--target', 'dir']), /Expected --name value pairs/);
    assert.throws(() => parseArgs(['--tag']), /Expected --name value pairs/);
    assert.throws(() => parseArgs(['source', '.']), /Expected --name value pairs/);
  });
});

describe('newerTags', () => {
  it('compares number by number, and ignores tags that are not versions', () => {
    const tags = ['v1.2.9', 'v0.10.0', 'v1.3.0', 'v1.10.0', 'v2.0.0', 'latest', 'v1.4.0-beta.1', 'v01.9.9', ''];

    assert.deepEqual(newerTags(tags, 'v1.3.0'), ['v1.10.0', 'v2.0.0']);
    assert.deepEqual(newerTags(tags, 'v2.0.0'), []);
    assert.throws(() => newerTags(tags, 'latest'), /latest is not vX\.Y\.Z/);
    assert.throws(() => newerTags([], 'v01.2.3'), /v01\.2\.3 is not vX\.Y\.Z/);
  });
});

describe('stripPrivateLinks', () => {
  it('drops a parenthesized reference into the private repository', () => {
    const text = `Fixed a bug ([#42](https://github.com/${PRIVATE}/issues/42)).`;

    assert.equal(stripPrivateLinks(text, PRIVATE), 'Fixed a bug.');
  });

  it('drops a group of references', () => {
    const text = `Fixed it ([#40](https://github.com/${PRIVATE}/issues/40), [#41](https://github.com/${PRIVATE}/pull/41)).`;

    assert.equal(stripPrivateLinks(text, PRIVATE), 'Fixed it.');
  });

  it('joins a line that opened with a reference to the line above, with LF or CRLF', () => {
    const lf = `- Moved to npm\n  ([#47](https://github.com/${PRIVATE}/issues/47)). Published with provenance.`;
    const crlf = lf.replace('\n', '\r\n');

    assert.equal(stripPrivateLinks(lf, PRIVATE), '- Moved to npm. Published with provenance.');
    assert.equal(stripPrivateLinks(crlf, PRIVATE), '- Moved to npm. Published with provenance.');
  });

  it('never joins a paragraph into an empty line or a heading above it', () => {
    const afterBlank = `### Fixed\n\n([#1](https://github.com/${PRIVATE}/issues/1)) Something.`;
    const afterHeading = `### Fixed\n([#1](https://github.com/${PRIVATE}/issues/1)) Something.`;

    assert.equal(stripPrivateLinks(afterBlank, PRIVATE), '### Fixed\n\nSomething.');
    assert.equal(stripPrivateLinks(afterHeading, PRIVATE), '### Fixed\nSomething.');
  });

  it('keeps a space when the joined line goes on with a word', () => {
    const text = `- Moved\n  ([#47](https://github.com/${PRIVATE}/issues/47)) and published.`;

    assert.equal(stripPrivateLinks(text, PRIVATE), '- Moved and published.');
  });

  it('keeps the text of any other link into the private repository', () => {
    const text = `See [the README](https://github.com/${PRIVATE}#readme) and [pull 3](https://github.com/${PRIVATE}/pull/3).`;

    assert.equal(stripPrivateLinks(text, PRIVATE), 'See the README and pull 3.');
  });

  it('leaves links to other repositories and sites alone', () => {
    const text = `[docs](https://docs.example.com) [other](https://github.com/${PRIVATE}-public/issues/1)`;

    assert.equal(stripPrivateLinks(text, PRIVATE), text);
  });
});

describe('findProblems', () => {
  const tree = (entries) => new Map(Object.entries(entries).map(([path, content]) => [path, { content: Buffer.from(content) }]));

  it('reports a forbidden string with its path and line, ignoring case', () => {
    assert.deepEqual(findProblems(tree({ 'a.md': 'fine\nmentions TOP-SECRET here\n' }), CONFIG), ['a.md:2: top-secret']);
    // Once, however many times the lists name it.
    const twice = { ...CONFIG, forbidden: ['TOP-SECRET', 'Top-Secret'], forbiddenPatterns: ['secret', 'secret'] };

    assert.deepEqual(findProblems(tree({ 'a.md': 'top-secret\n' }), twice), ['a.md:1: top-secret', 'a.md:1: /secret/']);
  });

  it('finds a needle wrapped across lines, behind a comment marker, escaped in JSON or URL-encoded', () => {
    assert.deepEqual(findProblems(tree({ 'a.md': 'the top-\n  secret, wrapped\n' }), CONFIG), ['a.md: top-secret (across lines)']);
    assert.deepEqual(findProblems(tree({ 'a.ts': '/**\n * top-\n * secret\n */\n' }), CONFIG), ['a.ts: top-secret (across lines)']);
    assert.deepEqual(
      findProblems(tree({ 'a.json': '{"url": "https:\\/\\/github.com\\/acme\\/other"}' }), CONFIG),
      ['a.json: /github\\.com[/:]acme/(?!public-sdk\\b)/ (across lines)'],
    );
    assert.deepEqual(
      findProblems(tree({ 'a.txt': 'https://github.com%2Facme%2Fother' }), CONFIG),
      ['a.txt: /github\\.com[/:]acme/(?!public-sdk\\b)/ (across lines)'],
    );
  });

  it('refuses a character that could hide or disguise text, in a file or a path', () => {
    const refused = (path, line, code) => `${path}:${line}: ${code}, a character outside the allowed set`;
    const check = (path, content = 'ok\n') => findProblems(tree({ [path]: content }), { ...CONFIG, forbidden: [] });

    assert.deepEqual(check('a.md', 'top\u00ad-secret\n'), [refused('a.md', 1, 'U+00AD')]);
    assert.deepEqual(check('a.md', 'fine\nnpm\u200b_x\n'), [refused('a.md', 2, 'U+200B')]);
    assert.deepEqual(check('a.md', 'right-to-left \u202e here\n'), [refused('a.md', 1, 'U+202E')]);
    assert.deepEqual(check('a.md', '\ufeffstarts with a byte order mark\n'), [refused('a.md', 1, 'U+FEFF')]);
    assert.deepEqual(check('a.md', 'cafe\u0301\n'), [refused('a.md', 1, 'U+0301')]);
    assert.deepEqual(check('a.md', '\uff54\uff4f\uff50\n'), [refused('a.md', 1, 'U+FF54')]);
    assert.deepEqual(check('a.md', 'x\u00b2 and \u1d56\n'), [refused('a.md', 1, 'U+00B2')]);
    assert.deepEqual(check('a.md', 'tw\u0456lio\n'), [refused('a.md', 1, 'U+0456')]);
    assert.deepEqual(check('a.md', 'a \u0133 ligature\n'), [refused('a.md', 1, 'U+0133')]);
    assert.deepEqual(check('a.md', 'one\rtwo\n'), [refused('a.md', 1, 'U+000D')]);
    assert.deepEqual(check('a.md', 'one\u2028two\n'), [refused('a.md', 1, 'U+2028')]);
    assert.deepEqual(check('a.md', 'bell\u0007\n'), [refused('a.md', 1, 'U+0007')]);
    // Look-alikes of ASCII punctuation, letter-like symbols, other spaces, format characters,
    // private-use and unassigned code points, and an invalid byte, decoded as U+FFFD.
    assert.deepEqual(check('a.md', 'll\u2011api\n'), [refused('a.md', 1, 'U+2011')]);
    assert.deepEqual(check('a.md', 'org\u2215repo\n'), [refused('a.md', 1, 'U+2215')]);
    assert.deepEqual(check('a.md', '\u2024context\n'), [refused('a.md', 1, 'U+2024')]);
    assert.deepEqual(check('a.md', 'a\u2581b\n'), [refused('a.md', 1, 'U+2581')]);
    assert.deepEqual(check('a.md', '\u2374ontal\n'), [refused('a.md', 1, 'U+2374')]);
    assert.deepEqual(check('a.md', 'a\u00a0b\n'), [refused('a.md', 1, 'U+00A0')]);
    assert.deepEqual(check('a.md', 'a\ufff9b\n'), [refused('a.md', 1, 'U+FFF9')]);
    assert.deepEqual(check('a.md', 'a\ue000b \u0378\n'), [refused('a.md', 1, 'U+E000')]);
    assert.deepEqual(findProblems(new Map([['a.md', { content: Buffer.from([0x76, 0x65, 0x67, 0xe0, 0x0a]) }]]), CONFIG), [refused('a.md', 1, 'U+FFFD')]);
    assert.deepEqual(check('a.md', 'x \u{1d42d}\n'), [refused('a.md', 1, 'U+1D42D')]);
    assert.deepEqual(check('a.md', 'yes\u01c3\n'), [refused('a.md', 1, 'U+01C3')]);
    assert.deepEqual(check('a.md', '6\u00f73\n'), [refused('a.md', 1, 'U+00F7')]);
    assert.deepEqual(check('a.md', '\u2139\ufe0f info\n'), [refused('a.md', 1, 'U+2139')]);
    assert.deepEqual(check('a.md', 'webhook\u25aaoffice\n'), [refused('a.md', 1, 'U+25AA')]);
    assert.deepEqual(check('a.md', 'n\u00ba 1 and 5 \u00b5s\n'), [refused('a.md', 1, 'U+00BA')]);
    assert.deepEqual(check('a.md', 'one\u2029two\n'), [refused('a.md', 1, 'U+2029')]);
    // Emoji, whatever they look like: one can spell a word, and their joiners and selectors are
    // invisible.
    const cp = (...codes) => String.fromCodePoint(...codes);

    assert.deepEqual(check('a.md', `${cp(0x26a0, 0xfe0f)} careful\n`), [refused('a.md', 1, 'U+26A0')]);
    assert.deepEqual(check('a.md', `done ${cp(0x2705)}\n`), [refused('a.md', 1, 'U+2705')]);
    assert.deepEqual(check('a.md', `${cp(0x1f1e7, 0x1f1f7)}\n`), [refused('a.md', 1, 'U+1F1E7')]);
    assert.deepEqual(check('a.md', `${cp(0x1f44d, 0x1f3fd)}\n`), [refused('a.md', 1, 'U+1F44D')]);
    assert.deepEqual(check('a.md', `a${cp(0xfe0f)}\n`), [refused('a.md', 1, 'U+FE0F')]);
    assert.deepEqual(check('a.md', `a${cp(0x200d)}b\n`), [refused('a.md', 1, 'U+200D')]);
    assert.deepEqual(check('a.md', `a${cp(0x7f)}b\n`), [refused('a.md', 1, 'U+007F')]);
    assert.deepEqual(check('a.md', `a${cp(0x1f3fd)}\n`), [refused('a.md', 1, 'U+1F3FD')]);
    // The edges of what is allowed, and the Latin letters refused all the same.
    assert.deepEqual(check('a.md', `${cp(0xc0)} ${cp(0x17e)} ~\n`), []);
    assert.deepEqual(check('a.md', `${cp(0x180)}\n`), [refused('a.md', 1, 'U+0180')]);
    assert.deepEqual(check('a.md', `a${cp(0x1f)}\n`), [refused('a.md', 1, 'U+001F')]);
    assert.deepEqual(check('a.md', `liguea${cp(0xfe)}i\n`), [refused('a.md', 1, 'U+00FE')]);
    assert.deepEqual(check('a.md', `${cp(0xde)}ONTAL\n`), [refused('a.md', 1, 'U+00DE')]);
    assert.deepEqual(check('a.md', `${cp(0xdf)}illing\n`), [refused('a.md', 1, 'U+00DF')]);
    assert.deepEqual(check('a.md', `token${cp(0x130)}\n`), [refused('a.md', 1, 'U+0130')]);
    // A `\r` that ends no line: at the end of the file, before another `\r`, or in a path.
    assert.deepEqual(check('a.md', 'last\r'), [refused('a.md', 1, 'U+000D')]);
    assert.deepEqual(check('src/a.ts\r'), ['src/a.ts\r: U+000D in the path, a character outside the allowed set']);
    assert.deepEqual(check('a.md', 'a\r\r\nb\n'), [refused('a.md', 1, 'U+000D')]);
    assert.deepEqual(check('src/top\u200bsecret.ts'), ['src/top\u200bsecret.ts: U+200B in the path, a character outside the allowed set']);
    // What a reviewer reads as it is: accented Latin letters, typography, tabs and CRLF line ends.
    assert.deepEqual(check('a.md', 'Configura\u00e7\u00e3o \u2014 S\u00e3o Paulo\u2026 \u2192\tok\r\nnext\n'), []);
  });

  it('finds a needle written with an accented letter, and the private repository\'s name', () => {
    const o = String.fromCodePoint(0xf3);
    const e = String.fromCodePoint(0xe9);

    assert.deepEqual(findProblems(tree({ 'a.md': `the t${o}p-s${e}cret plan\n` }), CONFIG), ['a.md:1: top-secret (read as ASCII)']);
    assert.deepEqual(findProblems(tree({ [`src/t${o}p-secret.ts`]: 'ok\n' }), CONFIG), [`src/t${o}p-secret.ts: top-secret (in the path, read as ASCII)`]);
    assert.deepEqual(findProblems(tree({ 'a.md': `the top-\n  s${e}cret\n` }), CONFIG), ['a.md: top-secret (across lines, read as ASCII)']);
    assert.deepEqual(findProblems(tree({ 'b.md': 'see private-sdk\n' }), CONFIG), ['b.md:1: private-sdk']);
  });

  it('reads each allowed character that stands for ASCII as that ASCII', () => {
    // Typography, and the Latin letters with no accent to strip, upper case too.
    const table = [
      [0x2013, '-'], [0x2014, '-'], [0x2026, '...'], [0x2018, "'"], [0x2019, "'"], [0x201c, '"'],
      [0x201d, '"'], [0xab, '"'], [0xbb, '"'], [0x2022, '.'], [0xb0, 'o'], [0xd7, 'x'], [0x2190, '<-'],
      [0x2192, '->'], [0x20ac, 'eur'],
      [0x131, 'i'], [0x138, 'k'], [0x142, 'l'], [0x141, 'l'], [0xf8, 'o'], [0xd8, 'o'], [0x111, 'd'],
      [0x110, 'd'], [0xf0, 'd'], [0xd0, 'd'], [0x127, 'h'], [0x126, 'h'], [0x167, 't'], [0x166, 't'],
      [0x14b, 'n'], [0x14a, 'n'], [0xe6, 'ae'], [0xc6, 'ae'], [0x153, 'oe'], [0x152, 'oe'],
    ];

    for (const [code, ascii] of table) {
      assert.deepEqual(
        findProblems(tree({ 'a.md': `x${String.fromCodePoint(code)}y\n` }), { ...CONFIG, forbidden: [`x${ascii}y`] }),
        [`a.md:1: x${ascii}y (read as ASCII)`],
        `U+${code.toString(16).toUpperCase()}`,
      );
    }
  });

  it('reads each line as is too, where an accented letter next to a token is a word boundary', () => {
    const token = `npm_${'a'.repeat(36)}`;
    const npm = '/\\bnpm_[a-z0-9]{36}\\b/';

    assert.deepEqual(findProblems(tree({ 'a.ts': `\u00e1${token}\n` }), CONFIG), [`a.ts:1: ${npm}`]);
    assert.deepEqual(findProblems(tree({ 'b.ts': `${token}\u00e9\n` }), CONFIG), [`b.ts:1: ${npm}`]);
    assert.deepEqual(findProblems(tree({ 'c.ts': `const k =\n  \u00e1${token}\n` }), CONFIG), [`c.ts:2: ${npm}`]);
    assert.deepEqual(findProblems(tree({ 'd.ts': `\u00e1${token.slice(0, 20)}\n  ${token.slice(20)}\n` }), CONFIG), [`d.ts: ${npm} (across lines)`]);
  });

  it('reports a forbidden string in a path', () => {
    assert.deepEqual(findProblems(tree({ 'src/top-secret.ts': 'ok\n' }), CONFIG), ['src/top-secret.ts: top-secret (in the path)']);
  });

  it('reports a link to another repository of the organization, and a credential', () => {
    const problems = findProblems(tree({
      'a.md': 'see https://github.com/acme/internal-api and https://github.com/acme/public-sdk\n',
      'b.txt': `token npm_${'a'.repeat(36)}\n`,
    }), CONFIG);

    assert.deepEqual(problems, ['a.md:1: /github\\.com[/:]acme/(?!public-sdk\\b)/', 'b.txt:1: /\\bnpm_[a-z0-9]{36}\\b/']);
  });

  it('refuses a binary or UTF-16 file unless it is allowed', () => {
    const files = new Map([
      ['logo.bin', { content: Buffer.from([0x89, 0x50, 0, 0x47]) }],
      ['notes.txt', { content: Buffer.from('\ufefftop-secret', 'utf16le') }],
    ]);

    assert.deepEqual(findProblems(files, CONFIG), ['logo.bin: binary file', 'notes.txt: binary file']);
    assert.deepEqual(findProblems(files, { ...CONFIG, binaryAllowed: ['logo.bin', 'notes.txt'] }), []);
  });
});

describe('buildRelease', () => {
  it('reads the ref, not the working tree', () => {
    const source = makeSource();

    write(source, 'src/index.ts', '// top-secret, written by a build step\n');

    assert.equal(buildRelease({ source, tag: 'v1.3.0' }).get('src/index.ts').content.toString(), 'export const answer = 42;\n');
  });

  it('refuses a version older than one the source already tagged, before anything is tagged', () => {
    const source = makeSource();

    git(source, 'tag', 'v1.10.0');

    assert.throws(() => buildRelease({ source, tag: 'v1.3.0' }), /source already has v1\.10\.0, newer than v1\.3\.0/);

    git(source, 'tag', '--delete', 'v1.10.0');
    git(source, 'tag', 'v1.3.0');

    assert.equal(buildRelease({ source, tag: 'v1.3.0' }).size > 0, true);
  });

  it('refuses a version that is not a string, even when it prints as the tag', () => {
    const source = makeSource({ 'package.json': JSON.stringify({ name: '@acme/sdk', version: ['1.3.0'] }) });

    assert.throws(() => buildRelease({ source, tag: 'v1.3.0' }), /does not match package\.json \(\["1\.3\.0"\]\)/);
  });

  it('refuses a tag that does not match package.json', () => {
    assert.throws(() => buildRelease({ source: makeSource(), tag: 'v9.9.9' }), /does not match package\.json \("1\.3\.0"\)/);
  });

  it('refuses a file in no list, or in more than one', () => {
    assert.throws(() => buildRelease({ source: makeSource({ 'docs/plan.md': 'x\n' }), tag: 'v1.3.0' }), /docs\/plan\.md: in none/);
    assert.throws(
      () => buildRelease({ source: makeSource({}, { exclude: [...CONFIG.exclude, 'src/'] }), tag: 'v1.3.0' }),
      /src\/index\.ts: in more than one/,
    );
    assert.throws(() => buildRelease({ source: makeSource({ 'public/other.md': 'x\n' }), tag: 'v1.3.0' }), /public\/other\.md: in none/);
  });

  it('refuses a symbolic link, which would otherwise publish whatever it points to', () => {
    const source = makeSource();

    symlinkSync('/etc/hostname', join(source, 'src', 'key.txt'));
    git(source, 'add', '--all');
    git(source, 'commit', '--quiet', '-m', 'link');

    assert.throws(() => buildRelease({ source, tag: 'v1.3.0' }), /src\/key\.txt: mode 120000/);
  });

  it('refuses an overlay file that would land on a public file, and lets it replace a private one', () => {
    assert.throws(
      () => buildRelease({ source: makeSource({ 'public/files/CHANGELOG.md': 'other\n' }), tag: 'v1.3.0' }),
      /public\/files\/CHANGELOG\.md: the overlay would land on CHANGELOG\.md/,
    );

    const files = buildRelease({ source: makeSource({ 'public/files/MAINTAINING.md': 'public notes\n' }), tag: 'v1.3.0' });

    assert.equal(files.get('MAINTAINING.md').content.toString(), 'public notes\n');
  });

  it('refuses a .git path, which would write into the target repository itself', () => {
    const source = makeSource();
    const blob = execFileSync('git', ['hash-object', '-w', '--stdin'], { cwd: source, input: 'echo ran\n', encoding: 'utf8' }).trim();
    const mktree = (entries) => execFileSync('git', ['mktree'], { cwd: source, input: entries, encoding: 'utf8' }).trim();
    const hooks = mktree(`100755 blob ${blob}\tpost-commit\n`);
    const dotGit = mktree(`040000 tree ${hooks}\thooks\n`);
    const head = git(source, 'ls-tree', 'HEAD').replace(/^040000 tree \S+\tpublic\n/m, '');
    const publicFiles = mktree(git(source, 'ls-tree', 'HEAD:public/files').concat(`040000 tree ${dotGit}\t.git\n`));
    const publicTree = mktree(git(source, 'ls-tree', 'HEAD:public').replace(/^040000 tree \S+\tfiles\n/m, '').concat(`040000 tree ${publicFiles}\tfiles\n`));
    const root = mktree(`${head}040000 tree ${publicTree}\tpublic\n`);
    const commit = git(source, 'commit-tree', root, '-p', 'HEAD', '-m', 'hook').trim();

    assert.throws(
      () => buildRelease({ source, tag: 'v1.3.0', ref: commit }),
      /public\/files\/\.git\/hooks\/post-commit: a \.git/,
    );
  });

  it('refuses a .gitmodules the overlay would put at the public root', () => {
    assert.throws(
      () => buildRelease({ source: makeSource({ 'public/files/.gitmodules': '[submodule "x"]\n' }), tag: 'v1.3.0' }),
      /public\/files\/\.gitmodules: a \.git, \.\., \., empty or \.gitmodules path/,
    );
    // Whatever the case: on a case-insensitive checkout it is the same file.
    assert.throws(
      () => buildRelease({ source: makeSource({ 'public/files/.GitModules': '[submodule "x"]\n' }), tag: 'v1.3.0' }),
      /public\/files\/\.GitModules: a \.git, \.\., \., empty or \.gitmodules path/,
    );
  });

  it('keeps a path with a tab whole', () => {
    const files = buildRelease({ source: makeSource({ 'src/a\tb.ts': 'tab\n' }), tag: 'v1.3.0' });

    assert.equal(files.get('src/a\tb.ts').content.toString(), 'tab\n');
  });

  it('lays the overlay at the root and drops the private files', () => {
    const files = buildRelease({ source: makeSource(), tag: 'v1.3.0' });

    assert.deepEqual([...files.keys()].sort(), [
      '.github/workflows/ci.yml', '.github/workflows/publish.yml', 'CHANGELOG.md', 'CONTRIBUTING.md', 'package.json', 'src/index.ts',
    ]);
    assert.equal(files.get('CHANGELOG.md').content.toString(), '- Added a thing.\n');
  });
});

describe('mirror', () => {
  it('commits and tags the release in the target', () => {
    const target = makeTarget();

    assert.equal(mirror({ source: makeSource(), target, tag: 'v1.3.0' }).status, 'committed');
    assert.equal(readFileSync(join(target, 'CONTRIBUTING.md'), 'utf8'), 'Contributions welcome.\n');
    assert.equal(existsSync(join(target, 'MAINTAINING.md')), false);
    assert.equal(git(target, 'log', '-1', '--format=%s').trim(), 'Release v1.3.0');
    assert.equal(git(target, 'tag', '--list', 'v1.3.0').trim(), 'v1.3.0');
  });

  it('commits a file the public .gitignore would ignore, and runs no hook of the target', () => {
    const source = makeSource({ '.gitignore': '*.log\n', 'src/fixture.log': 'kept\n' });
    const target = makeTarget();

    write(target, '.git/hooks/post-commit', '#!/bin/sh\ntouch "$(git rev-parse --show-toplevel)/HOOK-RAN"\n');
    execFileSync('chmod', ['+x', join(target, '.git/hooks/post-commit')]);

    mirror({ source, target, tag: 'v1.3.0' });

    assert.match(git(target, 'ls-files'), /src\/fixture\.log/);
    assert.equal(existsSync(join(target, 'HOOK-RAN')), false);
  });

  it('keeps the executable bit', () => {
    const source = makeSource({ 'bin/run.sh': '#!/bin/sh\n' });

    git(source, 'update-index', '--chmod=+x', 'bin/run.sh');
    git(source, 'commit', '--quiet', '-m', 'exec');

    const target = makeTarget();

    mirror({ source, target, tag: 'v1.3.0' });

    assert.equal(statSync(join(target, 'bin/run.sh')).mode & 0o111, 0o111);
  });

  it('builds on the previous release and removes what it dropped', () => {
    const target = makeTarget();

    write(target, 'old-file.txt', 'from the previous release\n');
    git(target, 'add', '--all');
    git(target, 'commit', '--quiet', '-m', 'Release v1.2.9');
    git(target, 'tag', 'v0.10.0');
    git(target, 'tag', 'v1.2.9');
    const previous = git(target, 'rev-parse', 'HEAD').trim();

    mirror({ source: makeSource(), target, tag: 'v1.3.0' });

    assert.equal(existsSync(join(target, 'old-file.txt')), false);
    assert.equal(git(target, 'rev-parse', 'HEAD^').trim(), previous);
  });

  it('does nothing when the target already has the tag', () => {
    const source = makeSource();
    const target = makeTarget();

    mirror({ source, target, tag: 'v1.3.0' });
    const head = git(target, 'rev-parse', 'HEAD');

    assert.deepEqual(mirror({ source, target, tag: 'v1.3.0' }), { status: 'exists' });
    assert.equal(git(target, 'rev-parse', 'HEAD'), head);
  });

  it('refuses to go back to an older version than the target has', () => {
    const target = makeTarget();

    write(target, 'newer.txt', 'from v1.10.0\n');
    git(target, 'add', '--all');
    git(target, 'commit', '--quiet', '-m', 'Release v1.10.0');
    git(target, 'tag', 'v1.10.0');
    const head = git(target, 'rev-parse', 'HEAD');

    // 1.10.0 is newer than 1.3.0, although it sorts before it as text.
    assert.throws(() => mirror({ source: makeSource(), target, tag: 'v1.3.0' }), /already has v1\.10\.0, newer than v1\.3\.0/);
    assert.equal(git(target, 'rev-parse', 'HEAD'), head);
    assert.deepEqual(readdirSync(target).sort(), ['.git', 'newer.txt']);
    assert.throws(() => mirror({ source: makeSource(), target, tag: 'latest' }), /latest is not vX\.Y\.Z/);
  });

  it('leaves the target untouched when a check fails', () => {
    const source = makeSource({ 'src/leak.ts': '// top-secret\n' });
    const target = makeTarget();

    write(target, 'kept.txt', 'still here\n');

    assert.throws(() => mirror({ source, target, tag: 'v1.3.0' }), /src\/leak\.ts:1: top-secret/);
    assert.deepEqual(readdirSync(target).sort(), ['.git', 'kept.txt']);
    assert.equal(git(target, 'tag', '--list').trim(), '');
  });

  it('refuses a target that is the source, or not the root of a repository', () => {
    const source = makeSource();

    assert.throws(() => mirror({ source, target: source, tag: 'v1.3.0' }), /the source repository/);
    assert.throws(() => mirror({ source, target: join(source, 'src'), tag: 'v1.3.0' }), /not the root of a git repository/);
    assert.deepEqual(readdirSync(join(source, 'src')), ['index.ts']);
  });
});

// The mirror of this repository itself, so a pull request that adds an unclassified file or a
// forbidden string fails here, before any release is tagged. The public repository has no
// `public/mirror.json`, and skips it.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('this repository', { skip: !existsSync(join(ROOT, 'public', 'mirror.json')) }, () => {
  it('builds a valid public tree at HEAD', () => {
    const { version } = JSON.parse(execFileSync('git', ['show', 'HEAD:package.json'], { cwd: ROOT, encoding: 'utf8' }));

    assert.ok(buildRelease({ source: ROOT, tag: `v${version}` }).size > 0);
  });
});
