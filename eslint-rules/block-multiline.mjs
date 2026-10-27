/**
 * Local ESLint rule: **the body of a control block is never inline**.
 *
 * For `if`/`else`/`for`/`for-in`/`for-of`/`while`/`do-while`/`try`/`catch`/`finally`,
 * the `{` is followed by a line break and the `}` is preceded by one — that is, the body
 * sits on lines of its own (pairs with `curly: all` to eliminate the inline `if`).
 *
 * It only INSERTS breaks (after `{` and before `}`); indentation is left to
 * `@stylistic/indent`. Function/arrow bodies are not targeted (in practice they are already multiline).
 */

/** Forces the body of a (non-empty) BlockStatement onto lines of its own. */
function handleBlock(
  context,
  sc,
  block,
) {
  if (
    block?.type !== 'BlockStatement'
    || block.body.length === 0
  ) {
    return;
  }

  const open = sc.getFirstToken(block);
  const close = sc.getLastToken(block);
  const first = block.body[0];
  const last = block.body[block.body.length - 1];
  const needsOpen = open.loc.end.line === first.loc.start.line;
  const needsClose = last.loc.end.line === close.loc.start.line;

  if (
    !needsOpen
    && !needsClose
  ) {
    return;
  }

  context.report({
    node: block,
    messageId: 'multiline',
    fix(fixer) {
      const fixes = [];

      if (needsOpen) {
        fixes.push(fixer.insertTextAfter(
          open,
          '\n',
        ));
      }

      if (needsClose) {
        fixes.push(fixer.insertTextBefore(
          close,
          '\n',
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
    docs: { description: 'Control-block body (if/loops/try...) on its own lines.' },
    fixable: 'whitespace',
    schema: [],
    messages: { multiline: 'The block body cannot be inline — put it on its own lines.' },
  },

  create(context) {
    const sc = context.sourceCode;

    return {
      IfStatement(node) {
        handleBlock(
          context,
          sc,
          node.consequent,
        );

        if (node.alternate?.type === 'BlockStatement') {
          handleBlock(
            context,
            sc,
            node.alternate,
          );
        }
      },
      ForStatement: (node) => handleBlock(
        context,
        sc,
        node.body,
      ),
      ForInStatement: (node) => handleBlock(
        context,
        sc,
        node.body,
      ),
      ForOfStatement: (node) => handleBlock(
        context,
        sc,
        node.body,
      ),
      WhileStatement: (node) => handleBlock(
        context,
        sc,
        node.body,
      ),
      DoWhileStatement: (node) => handleBlock(
        context,
        sc,
        node.body,
      ),
      CatchClause: (node) => handleBlock(
        context,
        sc,
        node.body,
      ),
      TryStatement(node) {
        handleBlock(
          context,
          sc,
          node.block,
        );

        handleBlock(
          context,
          sc,
          node.finalizer,
        );
      },
    };
  },
};
