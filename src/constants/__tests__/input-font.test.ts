import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

import coverage from '@/constants/input-font-coverage.json';
import { inputFontFamily } from '@/constants/input-font';
import { FONT_OPTIONS, fontEmphasis, typographyFor } from '@/constants/theme';

const ROOT = join(__dirname, '..', '..', '..');

describe('input font outline coverage', () => {
  it('ties the real-outline audit to the exact shipped font bytes', () => {
    for (const font of coverage) {
      const bytes = readFileSync(join(ROOT, font.file));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(font.sha256);
    }
  });

  it('documents why cmap membership alone misses the reported 루겓 blank', () => {
    const nanum = coverage.find((font) => font.family === 'NanumSquareRoundR')!;
    expect(nanum.probes['겓']).toEqual({ mapped: true, hasOutline: false, advance: 910 });
    expect(nanum.hangulMapped).toBe(11172);
    expect(nanum.hangulDrawn).toBeLessThan(nanum.hangulMapped);
  });

  it('uses a font with actual outlines for every Hangul syllable for every selectable face', () => {
    for (const option of FONT_OPTIONS) {
      const faces = [
        ...Object.values(typographyFor(option.id)),
        ...(['normal', 'medium', 'semibold', 'bold'] as const).map((weight) =>
          fontEmphasis(option.id, weight),
        ),
      ];
      for (const face of faces) {
        const family = 'fontFamily' in face ? face.fontFamily : undefined;
        if (!family) continue; // System text uses the platform's own fallback.
        const resolved = inputFontFamily(family);
        const audit = coverage.find((font) => font.family === resolved);
        expect(audit).toBeDefined();
        expect(audit?.hangulDrawn).toBe(11172);
        expect(audit?.probes['겓'].hasOutline).toBe(true);
      }
    }
  });

  it('routes every native input through the shared font correction', () => {
    const offenders: string[] = [];
    function visit(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const file = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== '__tests__') visit(file);
          continue;
        }
        if (!file.endsWith('.tsx') || entry.name === 'app-text-input.tsx') continue;
        const source = ts.createSourceFile(
          file,
          readFileSync(file, 'utf8'),
          ts.ScriptTarget.Latest,
        );
        for (const statement of source.statements) {
          if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
            continue;
          if (statement.moduleSpecifier.text !== 'react-native') continue;
          const clause = statement.importClause;
          const bindings = clause?.namedBindings;
          if (clause?.isTypeOnly || !bindings || !ts.isNamedImports(bindings)) continue;
          if (
            bindings.elements.some(
              (item) => !item.isTypeOnly && (item.propertyName ?? item.name).text === 'TextInput',
            )
          )
            offenders.push(file.replace(ROOT + '/', ''));
        }
      }
    }
    visit(join(ROOT, 'src', 'components'));
    expect(offenders).toEqual([]);
  });
});
