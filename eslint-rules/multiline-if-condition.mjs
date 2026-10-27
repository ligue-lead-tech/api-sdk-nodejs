/**
 * Local ESLint rule: **a condition with more than one clause goes on separate lines**.
 *
 * When the test of an `if`/`while`/`do-while` is a logical expression (`&&`/`||`)
 * with more than one clause, each clause sits on a line of its own, with the operator
 * leading the line ("before" style) and the parentheses on lines of their own:
 *
 *   if (
 *     items.length <= 1
 *     || !open
 *     || !close
 *   ) {
 *
 * The fixer inserts breaks + explicit indentation (`@stylistic/indent` does not cover
 * the continuation of a logical expression).
 *
 * What counts as "the top of the logical tree", measured rather than assumed: an operator
 * under a NON-logical node is left alone (`foo(a || b)` is untouched), but a PARENTHESIZED
 * logical operand is still descended into, because `collectLogicalOperators` recurses on
 * every `LogicalExpression` child regardless of parentheses. So
 *
 *   if (alpha && (beta || gamma)) {
 *
 * becomes
 *
 *   if (
 *     alpha
 *     && (beta
 *     || gamma)
 *   ) {
 *
 * — the inner group is split and its continuation is NOT indented past the outer one, so
 * the layout stops showing the precedence. Known and accepted for now: it is rare (2 sites
 * in this repository) and the output is valid. Do not "fix" the comment to claim the
 * parenthesized case is skipped — it is not.
 */

/** Collects the logical operator tokens (`&&`/`||`) from the top of `node`'s tree. */
function collectLogicalOperators(
  sc,
  node,
  ops,
) {
  if (node.type !== 'LogicalExpression') {
    return;
  }

  collectLogicalOperators(
    sc,
    node.left,
    ops,
  );

  const opToken = sc.getFirstTokenBetween(
    node.left,
    node.right,
    (token) => token.value === node.operator,
  );

  if (opToken) {
    ops.push(opToken);
  }

  collectLogicalOperators(
    sc,
    node.right,
    ops,
  );
}

/** Applies the rule to a node that has a `test` (if/while/do-while). */
function handle(
  context,
  sc,
  node,
) {
  const test = node.test;

  if (test?.type !== 'LogicalExpression') {
    return;
  }

  const open = sc.getTokenBefore(
    test,
    (token) => token.value === '(',
  );

  const close = sc.getTokenAfter(
    test,
    (token) => token.value === ')',
  );

  if (
    !open
    || !close
  ) {
    return;
  }

  const ops = [];

  collectLogicalOperators(
    sc,
    test,
    ops,
  );

  if (ops.length === 0) {
    return;
  }

  const splitAfterOpen = open.loc.end.line === test.loc.start.line;
  const splitBeforeClose = test.loc.end.line === close.loc.start.line;
  const inlineOps = ops.filter((op) => sc.getTokenBefore(op)?.loc.end.line === op.loc.start.line);

  if (
    !splitAfterOpen
    && !splitBeforeClose
    && inlineOps.length === 0
  ) {
    return;
  }

  context.report({
    node: test,
    messageId: 'multiline',
    fix(fixer) {
      // @stylistic/indent does not indent the continuation of a logical expression, so
      // the rule inserts the indentation explicitly: clauses at base+2, `)` at base.
      const base = sc.getFirstToken(node).loc.start.column;
      const inner = `\n${' '.repeat(base + 2)}`;
      const outer = `\n${' '.repeat(base)}`;
      const fixes = [];

      if (splitAfterOpen) {
        fixes.push(fixer.insertTextAfter(
          open,
          inner,
        ));
      }

      for (const op of inlineOps) {
        fixes.push(fixer.insertTextBefore(
          op,
          inner,
        ));
      }

      if (splitBeforeClose) {
        fixes.push(fixer.insertTextBefore(
          close,
          outer,
        ));
      }

      return fixes;
    },
  });
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'layout',
    docs: { description: 'Each clause (&&/||) of a composite condition on its own line.' },
    fixable: 'whitespace',
    schema: [],
    messages: { multiline: 'A condition with more than one clause (&&/||) must put each clause on its own line.' },
  },

  create(context) {
    const sc = context.sourceCode;

    return {
      IfStatement: (node) => handle(
        context,
        sc,
        node,
      ),
      WhileStatement: (node) => handle(
        context,
        sc,
        node,
      ),
      DoWhileStatement: (node) => handle(
        context,
        sc,
        node,
      ),
    };
  },
};
