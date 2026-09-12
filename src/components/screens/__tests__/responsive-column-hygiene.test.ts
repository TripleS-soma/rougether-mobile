import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as ts from 'typescript';

const SCREENS = join(__dirname, '..');

/**
 * 태블릿/큰 화면 폭 제한 위생 (#725).
 *
 * 화면은 전부 폰 폭(≈390)을 전제로 그려져 있어, 폭 제한이 없으면 넓은 화면에서
 * 행이 끝까지 늘어나거나 정사각형 캔버스가 화면을 삼킨다. `useResponsiveColumn()`이
 * 그 처방인데, **새 화면을 만들 때 잊기 쉽다** — 폰에서는 아무 증상이 없어서
 * 리뷰에서도 안 보인다. 그래서 파일 단위로 강제한다.
 *
 * 스타일 규칙(#382 폰트 위생)과 같은 취지: 사람이 기억해야 하는 규칙을 테스트로
 * 옮긴다.
 */

/**
 * 면제 — 이유를 파일별로 적는다. "아직 안 했음"은 면제 사유가 아니다.
 */
const EXEMPT: Record<string, string> = {
  // WebView가 외부 HTML을 그린다. 폭·타이포는 그 문서(rougether-landing)가
  // 스스로 정하므로 네이티브 쪽에서 묶으면 오히려 이중 여백이 된다.
  'policy-viewer-screen.tsx': 'WebView — 문서가 자기 레이아웃을 가진다',
  'policy-viewer-screen.web.tsx': 'WebView — 문서가 자기 레이아웃을 가진다',
  // 집 화면은 하늘이 화면을 꽉 채워야 한다 (#986). 560으로 묶으면 태블릿에서
  // 좌우가 크림으로 남아 목적과 정반대가 된다 — 의도적으로 캡에서 뺀 유일한 화면.
  'house-screen.tsx': '전체 폭 캔버스 — 하늘이 화면을 채워야 한다 (#986)',
};

/** Shared layouts are verified delegation, not width-limit exemptions. */
const DELEGATED_SCREENS: Record<string, string> = {
  'minigames-screen.tsx': 'MinigamesScreen',
  'minigame-runner-screen.tsx': 'MinigameRunnerScreen',
  'minigame-leaderboard-screen.tsx': 'MinigameLeaderboardScreen',
};

function parseScreen(file: string) {
  return ts.createSourceFile(
    file,
    readFileSync(join(SCREENS, file), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}

function unwrapParentheses(expression: ts.Expression | undefined): ts.Expression | undefined {
  if (expression && ts.isParenthesizedExpression(expression)) {
    return unwrapParentheses(expression.expression);
  }
  return expression;
}

function exportedFunction(source: ts.SourceFile, name: string) {
  return source.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === name &&
      statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ===
        true,
  );
}

describe('화면 폭 제한 위생 (#725)', () => {
  const files = readdirSync(SCREENS).filter((f) => f.endsWith('.tsx'));

  it('스캔 대상 화면이 실제로 존재한다', () => {
    // 경로가 바뀌어 0개를 스캔하면서 조용히 통과하는 걸 막는다.
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files.filter((f) => !(f in EXEMPT) && !(f in DELEGATED_SCREENS)))(
    '%s 가 useResponsiveColumn을 쓴다',
    (file) => {
      const src = readFileSync(join(SCREENS, file), 'utf8');
      expect(src).toContain('useResponsiveColumn');
    },
  );

  it.each(Object.entries(DELEGATED_SCREENS))(
    '%s 는 검증된 MinigameLayout으로 전체 화면을 감싼다',
    (file, componentName) => {
      const source = parseScreen(file);
      const layoutImport = source.statements.find(
        (statement): statement is ts.ImportDeclaration =>
          ts.isImportDeclaration(statement) &&
          ts.isStringLiteral(statement.moduleSpecifier) &&
          statement.moduleSpecifier.text === '@/components/screens/minigame-layout',
      );
      const bindings = layoutImport?.importClause?.namedBindings;
      expect(
        bindings &&
          ts.isNamedImports(bindings) &&
          bindings.elements.some(
            (binding) =>
              binding.name.text === 'MinigameLayout' &&
              (binding.propertyName?.text ?? binding.name.text) === 'MinigameLayout',
          ),
      ).toBe(true);
      const returned = exportedFunction(source, componentName)?.body?.statements.find(
        ts.isReturnStatement,
      );
      const expression = unwrapParentheses(returned?.expression);
      if (!expression || !ts.isJsxElement(expression)) {
        throw new Error(`${componentName} must return the shared layout as its root`);
      }
      expect(expression.openingElement.tagName.getText(source)).toBe('MinigameLayout');
      expect(expression.closingElement.tagName.getText(source)).toBe('MinigameLayout');
    },
  );

  it('공통 레이아웃이 useResponsiveColumn을 실제 호출한다', () => {
    const source = parseScreen('minigame-layout.tsx');
    const layout = exportedFunction(source, 'MinigameLayout');
    const hasColumnCall = layout?.body?.statements.some(
      (statement) =>
        ts.isVariableStatement(statement) &&
        statement.declarationList.declarations.some(
          (declaration) =>
            declaration.initializer &&
            ts.isCallExpression(declaration.initializer) &&
            ts.isIdentifier(declaration.initializer.expression) &&
            declaration.initializer.expression.text === 'useResponsiveColumn',
        ),
    );
    expect(hasColumnCall).toBe(true);
    // Rendered tablet/phone constraints are verified in minigame-layout.test.tsx.
  });

  it('위임 목록에 죽은 화면이 없다', () => {
    expect(Object.keys(DELEGATED_SCREENS).filter((file) => !files.includes(file))).toEqual([]);
  });

  it('면제 목록에 죽은 항목이 없다', () => {
    // 화면이 지워졌는데 면제만 남으면 다음 사람이 잘못된 전제를 읽는다.
    expect(Object.keys(EXEMPT).filter((f) => !files.includes(f))).toEqual([]);
  });
});
