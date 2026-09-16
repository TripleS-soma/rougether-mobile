import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CategoryFormSheet } from '@/components/screens/sheets/category-form-sheet';
import type { CategoryDeleteMode } from '@/api/categories';
import { Icon } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { CategoryIcon } from '@/components/ui/category-icon';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { type RoutineCategoryMeta, visibilityLabelKey } from '@/constants/routines';
import { Overlay, Radius, Spacing } from '@/constants/theme';
import { useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

export type CategoryManageScreenProps = {
  categories?: RoutineCategoryMeta[];
  /**
   * 카테고리별 남은 항목 수 (#517) — 서버는 "살아있는 루틴"이 있을 때만
   * 삭제를 거부한다(409). 루틴 수는 삭제 차단 안내에, 할 일 수는 삭제 모드
   * 선택 문구에 쓴다.
   */
  inUseCounts?: Record<string, { routines: number; todos: number }>;
  onCreate?: (category: RoutineCategoryMeta) => void;
  onUpdate?: (id: string, category: RoutineCategoryMeta) => void;
  /** 삭제 실행 (#517) — mode: UNASSIGN(미분류 전환) | PURGE(기록까지 삭제). */
  onDelete?: (id: string, mode: CategoryDeleteMode) => void;
  /** Persist a new category order (ids top→bottom; long-press a row to move). */
  onReorder?: (orderedIds: string[]) => void;
  onBack?: () => void;
};

/**
 * 카테고리 관리 독립 화면 (#394) — 기존 CategoryManagerSheet에서 분리.
 * 목록(꾹 눌러 순서 이동 / 수정 / 삭제)이 화면 본문이고, 생성·수정 폼은
 * 헤더의 `+`(생성)와 행의 연필(수정)이 띄우는 CategoryFormSheet가 담당한다.
 */
export function CategoryManageScreen({
  categories = [],
  inUseCounts = {},
  onCreate,
  onUpdate,
  onDelete,
  onReorder,
  onBack,
}: CategoryManageScreenProps) {
  const t = useTokens();
  const tr = useT();
  const column = useResponsiveColumn();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  // 떠 있는 글래스 헤더(#1069) 밑으로 콘텐츠가 지나가도록 상단 패딩.
  const headerInset = useHeaderContentInset();
  // null = 시트 닫힘, 'new' = 생성, 카테고리 = 그 항목 수정.
  const [formTarget, setFormTarget] = useState<'new' | RoutineCategoryMeta | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RoutineCategoryMeta | null>(null);
  // Delete tapped on a category that still has routines — warning only.
  const [blockedDelete, setBlockedDelete] = useState<RoutineCategoryMeta | null>(null);
  // Long-pressed row in move mode: its edit/delete buttons become ▲▼.
  const [movingId, setMovingId] = useState<string | null>(null);

  const moveCategory = (id: string, dir: -1 | 1) => {
    const from = categories.findIndex((c) => c.id === id);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= categories.length) return;
    const ids = categories.map((c) => c.id);
    [ids[from], ids[to]] = [ids[to], ids[from]];
    onReorder?.(ids);
  };

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <ScreenHeader
        title={tr('routineTodo.categoryManage.title')}
        onBack={onBack}
        backLabel={tr('routineTodo.categoryManage.back')}
        right={
          <Pressable
            onPress={() => setFormTarget('new')}
            accessibilityRole="button"
            // 시트 제출 버튼('카테고리 추가')과 라벨이 겹치지 않게 구분.
            accessibilityLabel={tr('routineTodo.categoryManage.addA11y')}
            style={[styles.iconBtn, { backgroundColor: t.primary }]}>
            <Icon name="add" size={20} color={t.onPrimary} />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={[
          styles.body,
          column,
          headerInset ? { paddingTop: headerInset } : null,
        ]}>
        {categories.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[Typography.body, styles.center, { color: t.textMuted }]}>
              {tr('routineTodo.categoryManage.emptyTitle')}
            </Text>
            <Text style={[Typography.supporting, styles.center, { color: t.textMuted }]}>
              {tr('routineTodo.categoryManage.emptyHint')}
            </Text>
          </View>
        ) : (
          <>
            <Text style={[Typography.label, { color: t.text }]}>
              {tr('routineTodo.categoryManage.mine', { count: categories.length })}
            </Text>
            {onReorder ? (
              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                {tr('routineTodo.categoryManage.reorderHint')}
              </Text>
            ) : null}
            <View style={styles.catList}>
              {categories.map((c, idx) => {
                const moving = movingId === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onLongPress={onReorder ? () => setMovingId(moving ? null : c.id) : undefined}
                    accessibilityLabel={tr('routineTodo.categoryManage.rowA11y', { name: c.name })}
                    accessibilityHint={
                      onReorder ? tr('routineTodo.categoryManage.rowHint') : undefined
                    }
                    style={[
                      styles.catRow,
                      { backgroundColor: t.surface, borderLeftColor: c.color },
                      moving && { borderWidth: 2, borderColor: t.primary, borderLeftWidth: 4 },
                    ]}>
                    <View style={[styles.catDot, { backgroundColor: `${c.color}33` }]}>
                      <CategoryIcon name={c.icon} color={c.color} size={16} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={[Typography.body, { color: t.text }]}>{c.name}</Text>
                      <Text style={[Typography.supporting, { color: t.textMuted }]}>
                        {moving
                          ? tr('routineTodo.categoryManage.moving')
                          : tr(visibilityLabelKey(c.visibility))}
                      </Text>
                    </View>
                    {moving ? (
                      <>
                        <Pressable
                          onPress={() => moveCategory(c.id, -1)}
                          disabled={idx === 0}
                          accessibilityRole="button"
                          accessibilityLabel={tr('routineTodo.categoryManage.moveUpA11y', {
                            name: c.name,
                          })}
                          style={[
                            styles.rowBtn,
                            { backgroundColor: idx === 0 ? t.surfaceMuted : t.primarySoft },
                          ]}>
                          <Text
                            style={[
                              styles.moveGlyph,
                              emph('bold'),
                              { color: idx === 0 ? t.textDisabled : t.primary },
                            ]}>
                            ▲
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => moveCategory(c.id, 1)}
                          disabled={idx === categories.length - 1}
                          accessibilityRole="button"
                          accessibilityLabel={tr('routineTodo.categoryManage.moveDownA11y', {
                            name: c.name,
                          })}
                          style={[
                            styles.rowBtn,
                            {
                              backgroundColor:
                                idx === categories.length - 1 ? t.surfaceMuted : t.primarySoft,
                            },
                          ]}>
                          <Text
                            style={[
                              styles.moveGlyph,
                              {
                                color: idx === categories.length - 1 ? t.textDisabled : t.primary,
                              },
                            ]}>
                            ▼
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setMovingId(null)}
                          accessibilityRole="button"
                          accessibilityLabel={tr('routineTodo.categoryManage.moveDoneA11y')}
                          style={[styles.rowBtn, { backgroundColor: t.primary }]}>
                          <Icon name="check" size={16} color={t.onPrimary} />
                        </Pressable>
                      </>
                    ) : (
                      <>
                        <Pressable
                          onPress={() => setFormTarget(c)}
                          accessibilityRole="button"
                          accessibilityLabel={tr('routineTodo.categoryManage.editA11y', {
                            name: c.name,
                          })}
                          style={[styles.rowBtn, { backgroundColor: t.surfaceMuted }]}>
                          <Icon name="edit" size={16} color={t.text} />
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            // 살아있는 루틴만 삭제를 막는다 (#517) — 할 일은
                            // 삭제 모드(미분류/완전 삭제)가 처리한다.
                            if ((inUseCounts[c.id]?.routines ?? 0) > 0) setBlockedDelete(c);
                            else setPendingDelete(c);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={tr('routineTodo.categoryManage.deleteA11y', {
                            name: c.name,
                          })}
                          style={[styles.rowBtn, { backgroundColor: t.dangerSoft }]}>
                          <Icon name="trash" size={16} color={t.danger} />
                        </Pressable>
                      </>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      <CategoryFormSheet
        visible={formTarget !== null}
        editing={formTarget === 'new' ? null : formTarget}
        categoryCount={categories.length}
        onCreate={onCreate}
        onUpdate={onUpdate}
        onClose={() => setFormTarget(null)}
      />

      {blockedDelete ? (
        <ConfirmDialog
          visible
          title={tr('routineTodo.categoryManage.blockedTitle')}
          body={tr('routineTodo.categoryManage.blockedBody', {
            name: blockedDelete.name,
            count: inUseCounts[blockedDelete.id]?.routines ?? 0,
          })}
          confirmLabel={tr('routineTodo.categoryManage.blockedConfirm')}
          confirmAccessibilityLabel={tr('routineTodo.categoryManage.blockedConfirmA11y')}
          cancelLabel={null}
          onConfirm={() => setBlockedDelete(null)}
          onCancel={() => setBlockedDelete(null)}
        />
      ) : null}

      {pendingDelete ? (
        <View style={styles.confirmOverlay}>
          <Pressable style={styles.backdrop} onPress={() => setPendingDelete(null)} />
          <View style={[styles.confirmCard, { backgroundColor: t.screen }]}>
            <Text style={[Typography.h3, { color: t.text }]}>
              {tr('routineTodo.categoryManage.deleteTitle', { name: pendingDelete.name })}
            </Text>
            <Text style={[Typography.body, styles.confirmText, { color: t.textMuted }]}>
              {(inUseCounts[pendingDelete.id]?.todos ?? 0) > 0
                ? `${tr('routineTodo.categoryManage.deleteTodosLeft', { count: inUseCounts[pendingDelete.id]?.todos })}\n`
                : ''}
              {tr('routineTodo.categoryManage.deletePurgeWarning')}
            </Text>
            <View style={styles.leaveBtns}>
              <Pressable
                onPress={() => {
                  onDelete?.(pendingDelete.id, 'UNASSIGN');
                  setPendingDelete(null);
                }}
                accessibilityRole="button"
                accessibilityLabel={tr('routineTodo.categoryManage.deleteUnassign')}
                style={[styles.leaveBtn, { backgroundColor: t.primary }]}>
                <Text style={[Typography.label, { color: t.onPrimary }]}>
                  {tr('routineTodo.categoryManage.deleteUnassign')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  onDelete?.(pendingDelete.id, 'PURGE');
                  setPendingDelete(null);
                }}
                accessibilityRole="button"
                accessibilityLabel={tr('routineTodo.categoryManage.deletePurge')}
                style={[styles.leaveBtn, { backgroundColor: t.danger }]}>
                <Text style={[Typography.label, { color: t.onPrimary }]}>
                  {tr('routineTodo.categoryManage.deletePurge')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setPendingDelete(null)}
                accessibilityRole="button"
                accessibilityLabel={tr('common.cancel')}
                style={styles.leaveStay}>
                <Text style={[Typography.label, { color: t.textMuted }]}>
                  {tr('common.cancel')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.six,
  },
  center: { textAlign: 'center' },
  catList: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.lg,
    borderLeftWidth: 4,
    padding: Spacing.three,
  },
  catDot: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveGlyph: { fontSize: 16 },
  rowBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Overlay.dim,
  },
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    elevation: 200,
  },
  confirmCard: {
    width: '80%',
    maxWidth: 340,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  confirmText: {
    lineHeight: 24,
  },
  leaveBtns: {
    alignSelf: 'stretch',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  leaveBtn: {
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
    alignItems: 'center',
  },
  leaveStay: {
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
});
