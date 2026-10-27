/**
 * Local ESLint rule: **one item per line whenever there is more than one**.
 *
 * Covers:
 * - parameters of a function/method definition (`params`);
 * - arguments of a call/`new` (`arguments`);
 * - properties of an object literal and of a `{}` destructuring (ObjectExpression/ObjectPattern);
 * - elements of an array literal `[]` and of a destructuring (ArrayExpression/ArrayPattern);
 * - members of an inline type literal `{ a: T; b: U }` (TSTypeLiteral).
 *
 * SKIPS: decorators (`@Decorator('x','y')`), the test DSL (`describe`/`it`/...) and
 * params that carry decorators (e.g. `@Body()`).
 *
 * The fixer only INSERTS line breaks (comments/code are preserved); indentation is
 * left to `@stylistic/indent` and the trailing comma to `@stylistic/comma-dangle`.
 */

/** Test globals whose calls (string + callback) must not be broken across lines. */
const TEST_DSL = new Set([
  'describe',
  'it',
  'test',
  'beforeAll',
  'afterAll',
  'beforeEach',
  'afterEach',
  'xdescribe',
  'xit',
  'fdescribe',
  'fit',
]);

/** True when every item already sits on a line of its own (between `open` and `close`). */
function isOnePerLine(
  open,
  items,
  close,
) {
  if (open.loc.end.line === items[0].loc.start.line) {
    return false;
  }

  for (let index = 1; index < items.length; index++) {
    if (items[index - 1].loc.end.line === items[index].loc.start.line) {
      return false;
    }
  }

  return items[items.length - 1].loc.end.line !== close.loc.start.line;
}

/** Reports and fixes (by inserting breaks) when there is > 1 item not one-per-line. */
function check(
  context,
  sc,
  node,
  rawItems,
  open,
  close,
) {
  const items = rawItems.filter(Boolean);

  if (
    items.length <= 1
    || !open
    || !close
  ) {
    return;
  }

  if (isOnePerLine(
    open,
    items,
    close,
  )) {
    return;
  }

  context.report({
    node,
    messageId: 'onePerLine',
    fix(fixer) {
      const fixes = [];

      if (open.loc.end.line === items[0].loc.start.line) {
        fixes.push(fixer.insertTextAfter(
          open,
          '\n',
        ));
      }

      for (let index = 1; index < items.length; index++) {
        if (items[index - 1].loc.end.line !== items[index].loc.start.line) {
          continue;
        }

        const comma = sc.getTokenAfter(
          items[index - 1],
          (token) => token.value === ',',
        );

        if (
          comma
          && comma.range[1] <= items[index].range[0]
        ) {
          fixes.push(fixer.insertTextAfter(
            comma,
            '\n',
          ));
        } else {
          fixes.push(fixer.insertTextBefore(
            items[index],
            '\n',
          ));
        }
      }

      if (items[items.length - 1].loc.end.line === close.loc.start.line) {
        fixes.push(fixer.insertTextBefore(
          close,
          '\n',
        ));
      }

      return fixes;
    },
  });
}

/** Parentheses surrounding a params/args list (`(` before the 1st, `)` after the last). */
function parensAround(
  sc,
  first,
  last,
) {
  return {
    open: sc.getTokenBefore(
      first,
      (token) => token.value === '(',
    ),
    close: sc.getTokenAfter(
      last,
      (token) => token.value === ')',
    ),
  };
}

/** Checks the parameters of a function/method definition. */
function checkParams(
  context,
  sc,
  node,
) {
  const params = node.params ?? [];

  if (params.length <= 1) {
    return;
  }

  if (params.some((param) => Array.isArray(param.decorators) && param.decorators.length > 0)) {
    return;
  }

  const open = sc.getFirstToken(
    node,
    (token) => token.value === '(',
  );

  const close = sc.getTokenAfter(
    params[params.length - 1],
    (token) => token.value === ')',
  );

  check(
    context,
    sc,
    node,
    params,
    open,
    close,
  );
}

/** Checks the arguments of a call/`new` (skips decorators and the test DSL). */
function checkArgs(
  context,
  sc,
  node,
) {
  const args = node.arguments ?? [];

  if (args.length <= 1) {
    return;
  }

  if (node.parent?.type === 'Decorator') {
    return;
  }

  if (
    node.callee?.type === 'Identifier'
    && TEST_DSL.has(node.callee.name)
  ) {
    return;
  }

  const {
    open,
    close,
  } = parensAround(
    sc,
    args[0],
    args[args.length - 1],
  );

  check(
    context,
    sc,
    node,
    args,
    open,
    close,
  );
}

/** Checks the items between `{}`/`[]` (object/array literals and destructurings). */
function checkBracketed(
  context,
  sc,
  node,
  items,
) {
  if (items.filter(Boolean).length > 1) {
    check(
      context,
      sc,
      node,
      items,
      sc.getFirstToken(node),
      sc.getLastToken(node),
    );
  }
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'layout',
    docs: { description: 'One item per line when there is more than one (params, args, objects, arrays).' },
    fixable: 'whitespace',
    schema: [],
    messages: { onePerLine: 'With more than one item, each must sit on its own line.' },
  },

  create(context) {
    const sc = context.sourceCode;

    return {
      ObjectExpression: (node) => checkBracketed(
        context,
        sc,
        node,
        node.properties,
      ),
      ObjectPattern: (node) => checkBracketed(
        context,
        sc,
        node,
        node.properties,
      ),
      ArrayExpression: (node) => checkBracketed(
        context,
        sc,
        node,
        node.elements,
      ),
      ArrayPattern: (node) => checkBracketed(
        context,
        sc,
        node,
        node.elements,
      ),
      TSTypeLiteral: (node) => checkBracketed(
        context,
        sc,
        node,
        node.members,
      ),
      FunctionDeclaration: (node) => checkParams(
        context,
        sc,
        node,
      ),
      FunctionExpression: (node) => checkParams(
        context,
        sc,
        node,
      ),
      ArrowFunctionExpression: (node) => checkParams(
        context,
        sc,
        node,
      ),
      TSDeclareFunction: (node) => checkParams(
        context,
        sc,
        node,
      ),
      CallExpression: (node) => checkArgs(
        context,
        sc,
        node,
      ),
      NewExpression: (node) => checkArgs(
        context,
        sc,
        node,
      ),
    };
  },
};
