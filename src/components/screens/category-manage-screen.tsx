import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CategoryFormSheet } from '@/components/screens/sheets/category-form-sheet';
import type { CategoryDeleteMode } from '@/api/categories';
import { Icon } from '@/components/ui/icon';
import { CategoryIcon } from '@/components/ui/category-icon';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { type RoutineCategoryMeta, VISIBILITY_LABELS } from '@/constants/routines';
import { Overlay, Radius, Spacing } from '@/constants/theme';
import { useHeaderInsetStyle, useScreenStyle } from '@/hooks/use-screen-style';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';

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
  const column = useResponsiveColumn();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const headerInset = useHeaderInsetStyle();
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
      <View style={[styles.header, headerInset, { backgroundColor: t.surface }]}>
        <View style={styles.headerLeft}>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="뒤로가기"
            style={[styles.iconBtn, { backgroundColor: t.surfaceMuted }]}>
            <Icon name="back" size={26} color={t.text} />
          </Pressable>
          <Text style={[Typography.h2, { color: t.text }]}>카테고리 관리</Text>
        </View>
        <Pressable
          onPress={() => setFormTarget('new')}
          accessibilityRole="button"
          // 시트 제출 버튼('카테고리 추가')과 라벨이 겹치지 않게 구분.
          accessibilityLabel="새 카테고리 추가"
          style={[styles.iconBtn, { backgroundColor: t.primary }]}>
          <Icon name="add" size={20} color={t.onPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.body, column]}>
        {categories.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[Typography.body, styles.center, { color: t.textMuted }]}>
              아직 카테고리가 없어요.
            </Text>
            <Text style={[Typography.supporting, styles.center, { color: t.textMuted }]}>
              오른쪽 위 + 버튼으로 첫 카테고리를 만들어보세요.
            </Text>
          </View>
        ) : (
          <>
            <Text style={[Typography.label, { color: t.text }]}>
              내 카테고리 ({categories.length})
            </Text>
            {onReorder ? (
              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                카테고리를 꾹 누르면 순서를 바꿀 수 있어요.
              </Text>
            ) : null}
            <View style={styles.catList}>
              {categories.map((c, idx) => {
                const moving = movingId === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onLongPress={onReorder ? () => setMovingId(moving ? null : c.id) : undefined}
                    accessibilityLabel={`${c.name} 카테고리`}
                    accessibilityHint={onReorder ? '꾹 누르면 순서 이동 모드가 켜져요' : undefined}
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
                          ? '순서 이동 중 — 완료를 누르면 끝나요'
                          : VISIBILITY_LABELS[c.visibility]}
                      </Text>
                    </View>
                    {moving ? (
                      <>
                        <Pressable
                          onPress={() => moveCategory(c.id, -1)}
                          disabled={idx === 0}
                          accessibilityRole="button"
                          accessibilityLabel={`${c.name} 위로 이동`}
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
                          accessibilityLabel={`${c.name} 아래로 이동`}
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
                          accessibilityLabel="순서 이동 완료"
                          style={[styles.rowBtn, { backgroundColor: t.primary }]}>
                          <Icon name="check" size={16} color={t.onPrimary} />
                        </Pressable>
                      </>
                    ) : (
                      <>
                        <Pressable
                          onPress={() => setFormTarget(c)}
                          accessibilityRole="button"
                          accessibilityLabel={`${c.name} 수정`}
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
                          accessibilityLabel={`${c.name} 삭제`}
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
          title="루틴을 먼저 정리해주세요"
          body={`‘${blockedDelete.name}’ 카테고리에 루틴 ${inUseCounts[blockedDelete.id]?.routines ?? 0}개가 있어요.\n루틴을 삭제하거나 다른 카테고리로 옮긴 뒤 삭제할 수 있어요.`}
          confirmLabel="확인"
          confirmAccessibilityLabel="삭제 불가 확인"
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
              &lsquo;{pendingDelete.name}&rsquo; 카테고리를 삭제할까요?
            </Text>
            <Text style={[Typography.body, styles.confirmText, { color: t.textMuted }]}>
              {(inUseCounts[pendingDelete.id]?.todos ?? 0) > 0
                ? `할 일 ${inUseCounts[pendingDelete.id]?.todos}개가 남아 있어요 — 미분류로 남기거나 함께 삭제할 수 있어요.\n`
                : ''}
              완전 삭제는 이 카테고리 루틴의 과거 수행 기록까지 지워져 되돌릴 수 없어요.
            </Text>
            <View style={styles.leaveBtns}>
              <Pressable
                onPress={() => {
                  onDelete?.(pendingDelete.id, 'UNASSIGN');
                  setPendingDelete(null);
                }}
                accessibilityRole="button"
                accessibilityLabel="미분류로 두고 삭제"
                style={[styles.leaveBtn, { backgroundColor: t.primary }]}>
                <Text style={[Typography.label, { color: t.onPrimary }]}>미분류로 두고 삭제</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  onDelete?.(pendingDelete.id, 'PURGE');
                  setPendingDelete(null);
                }}
                accessibilityRole="button"
                accessibilityLabel="기록까지 완전 삭제"
                style={[styles.leaveBtn, { backgroundColor: t.danger }]}>
                <Text style={[Typography.label, { color: t.onPrimary }]}>기록까지 완전 삭제</Text>
              </Pressable>
              <Pressable
                onPress={() => setPendingDelete(null)}
                accessibilityRole="button"
                accessibilityLabel="취소"
                style={styles.leaveStay}>
                <Text style={[Typography.label, { color: t.textMuted }]}>취소</Text>
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
    borderRadius: 20,
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
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveGlyph: { fontSize: 16 },
  rowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
