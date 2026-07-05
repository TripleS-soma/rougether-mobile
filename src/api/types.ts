/**
 * TypeScript types generated from the Rougether User API v1 OpenAPI spec
 * (http://43.203.209.107:8080/v3/api-docs). Regenerate with `npm run gen:api-types`. Do not edit by hand.
 */

export type CategoryCreateRequest = {
  name: string;
  colorHex?: string;
  iconKey?: string;
  sortOrder?: number;
  visibility?: 'PRIVATE' | 'HOUSE';
};

export type CategoryListResponse = {
  items?: CategoryResponse[];
};

export type CategoryResponse = {
  id?: number;
  name?: string;
  colorHex?: string;
  iconKey?: string;
  sortOrder?: number;
  visibility?: 'PRIVATE' | 'HOUSE';
};

export type CategoryUpdateRequest = {
  name?: string;
  colorHex?: string;
  iconKey?: string;
  sortOrder?: number;
  visibility?: 'PRIVATE' | 'HOUSE';
};

export type CharacterItem = {
  id?: number;
  code?: string;
  name?: string;
  baseAssetKey?: string;
  sortOrder?: number;
};

export type CharacterListResponse = {
  items?: CharacterItem[];
};

export type DevLoginRequest = {
  userId?: number;
};

export type DrawResult = {
  rewardType?: string;
  itemId?: number;
  characterId?: number;
  name?: string;
  assetKey?: string;
  rarity?: string;
  converted?: boolean;
  refundCurrencyType?: 'COIN' | 'DIAMOND';
  refundAmount?: number;
};

export type GachaDrawRequest = {
  count: number;
};

export type GachaDrawResponse = {
  results?: DrawResult[];
  wallets?: WalletSummary[];
};

export type GachaListResponse = {
  items?: GachaResponse[];
};

export type GachaResponse = {
  gachaId?: number;
  code?: string;
  name?: string;
  themeId?: number;
  costCurrencyType?: 'COIN' | 'DIAMOND';
  costAmount?: number;
  drawCount?: number;
  active?: boolean;
};

export type GoalItem = {
  id?: number;
  code?: string;
  name?: string;
  sortOrder?: number;
};

export type GoalListResponse = {
  items?: GoalItem[];
};

export type GoalSelection = {
  goalId?: number;
  code?: string;
  name?: string;
};

export type GoalSummary = {
  goalId?: number;
  code?: string;
  name?: string;
};

export type GoogleLoginRequest = {
  idToken: string;
};

export type HouseCreateRequest = {
  name: string;
  description?: string;
  coverImageKey?: string;
  maxMembers?: number;
  goalIds: number[];
};

export type HouseCreateResponse = {
  houseId?: number;
  ownerUserId?: number;
  inviteCode?: string;
  inviteExpiresAt?: string;
};

export type HouseDetailResponse = {
  houseId?: number;
  name?: string;
  description?: string;
  coverImageKey?: string;
  maxMembers?: number;
  currentMemberCount?: number;
  level?: number;
  growthPoints?: number;
  goals?: GoalSummary[];
  myRole?: 'OWNER' | 'MEMBER';
  inviteCode?: string;
  inviteExpiresAt?: string;
};

export type HouseJoinByCodeRequest = {
  inviteCode: string;
};

export type HouseJoinDetailResponse = {
  membershipId?: number;
  houseId?: number;
  userId?: number;
  role?: 'OWNER' | 'MEMBER';
  status?: 'ACTIVE' | 'LEFT' | 'KICKED';
  joinedAt?: string;
};

export type HouseJoinResponse = {
  membershipId?: number;
  houseId?: number;
  status?: 'ACTIVE' | 'LEFT' | 'KICKED';
};

export type HouseListResponse = {
  items?: HouseSummary[];
  page?: number;
  size?: number;
  totalElements?: number;
};

export type HouseMemberListResponse = {
  items?: MemberSummary[];
};

export type HousePreviewResponse = {
  houseId?: number;
  name?: string;
  coverImageKey?: string;
  currentMemberCount?: number;
  maxMembers?: number;
  inviteExpired?: boolean;
};

export type HouseSummary = {
  houseId?: number;
  name?: string;
  coverImageKey?: string;
  currentMemberCount?: number;
  maxMembers?: number;
  level?: number;
  goals?: GoalSummary[];
};

export type HouseUpdateRequest = {
  name?: string;
  description?: string;
  coverImageKey?: string;
  maxMembers?: number;
};

export type HouseUpdateResponse = {
  houseId?: number;
  name?: string;
  description?: string;
  coverImageKey?: string;
  maxMembers?: number;
};

export type InviteCodeResponse = {
  inviteCode?: string;
  inviteExpiresAt?: string;
};

export type ItemListResponse = {
  items?: ItemResponse[];
};

export type ItemResponse = {
  id?: number;
  name?: string;
  assetKey?: string;
  placementType?: string;
  surfaceSlotType?: string;
  characterSlotType?: string;
  defaultSlot?: string;
  categoryCode?: string;
  purchaseCurrencyType?: string;
  priceAmount?: number;
  isLimited?: boolean;
  theme?: ThemeSummary;
  owned?: boolean;
};

export type KakaoLoginRequest = {
  accessToken: string;
};

export type LoginResponse = {
  userId?: number;
  accessToken?: string;
  refreshToken?: string;
  isNewUser?: boolean;
};

export type LogoutRequest = {
  refreshToken: string;
};

export type MeResponse = {
  userId?: number;
  nickname?: string;
  lastLoginAt?: string;
  onboarding?: OnboardingSummary;
};

export type MemberSummary = {
  membershipId?: number;
  userId?: number;
  nickname?: string;
  role?: 'OWNER' | 'MEMBER';
  status?: 'ACTIVE' | 'LEFT' | 'KICKED';
  joinedAt?: string;
};

export type MyHouseListResponse = {
  items?: MyHouseSummary[];
};

export type MyHouseSummary = {
  houseId?: number;
  name?: string;
  coverImageKey?: string;
  level?: number;
  currentMemberCount?: number;
  maxMembers?: number;
  myRole?: 'OWNER' | 'MEMBER';
  joinedAt?: string;
};

export type MyItemListResponse = {
  items?: MyItemSummary[];
};

export type MyItemSummary = {
  userItemId?: number;
  itemId?: number;
  name?: string;
  assetKey?: string;
  categoryCode?: string;
  placementType?: string;
  surfaceSlotType?: string;
  characterSlotType?: string;
  defaultSlot?: string;
  theme?: ThemeSummary;
  acquiredAt?: string;
};

export type OnboardingCharacterRequest = {
  characterId: number;
};

export type OnboardingCharacterResponse = {
  selectedCharacterId?: number;
};

export type OnboardingGoalsRequest = {
  goalIds?: number[];
  primaryGoalId?: number;
};

export type OnboardingGoalsResponse = {
  goals?: GoalSelection[];
  primaryGoalId?: number;
};

export type OnboardingResponse = {
  goals?: GoalSelection[];
  primaryGoalId?: number;
  selectedCharacterId?: number;
  completed?: boolean;
};

export type OnboardingSummary = {
  completed?: boolean;
  primaryGoalId?: number;
  selectedCharacterId?: number;
};

export type PurchaseResponse = {
  userItemId?: number;
  itemId?: number;
  acquiredAt?: string;
  wallet?: WalletSummary;
};

export type RefreshRequest = {
  refreshToken: string;
};

export type RepeatDays = {
  daysOfWeek?: string[];
};

export type RoomCharacterResponse = {
  characterId?: number;
  code?: string;
  name?: string;
  assetKey?: string;
};

export type RoomResponse = {
  roomUserId?: number;
  growthLevel?: number;
  character?: RoomCharacterResponse;
  slots?: RoomSlotResponse[];
  streak?: RoomStreakResponse;
  updatedAt?: string;
};

export type RoomSlotResponse = {
  slotType?: string;
  userItemId?: number;
  assetKey?: string;
  savedAt?: string;
};

export type RoomSlotUpdateRequest = {
  slots: SlotAssignment[];
};

export type RoomStreakResponse = {
  currentCount?: number;
  longestCount?: number;
};

export type RoutineCreateRequest = {
  title: string;
  categoryId?: number;
  authType: 'CHECK' | 'PHOTO';
  repeatType: string;
  repeatDays?: RepeatDays;
  scheduledTime?: string;
  startsOn?: string;
  endsOn?: string;
};

export type RoutineListResponse = {
  items?: RoutineResponse[];
};

export type RoutineLogCreateRequest = {
  routineDate?: string;
};

export type RoutineLogResponse = {
  id?: number;
  routineDate?: string;
  status?: 'PENDING' | 'COMPLETED' | 'MISSED';
  completedAt?: string;
  rewardCurrencyType?: 'COIN' | 'DIAMOND';
  rewardAmount?: number;
  streak?: StreakSummaryResponse;
};

export type RoutineResponse = {
  id?: number;
  title?: string;
  categoryId?: number;
  authType?: 'CHECK' | 'PHOTO';
  status?: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  repeatType?: string;
  repeatDays?: RepeatDays;
  scheduledTime?: string;
  startsOn?: string;
  endsOn?: string;
};

export type RoutineUpdateRequest = {
  title?: string;
  categoryId?: number;
  authType?: 'CHECK' | 'PHOTO';
  repeatType?: string;
  repeatDays?: RepeatDays;
  scheduledTime?: string;
  startsOn?: string;
  endsOn?: string;
};

export type SlotAssignment = {
  slotType: string;
  userItemId?: number;
};

export type StreakSummaryResponse = {
  currentCount?: number;
  longestCount?: number;
  lastSuccessDate?: string;
};

export type ThemeSummary = {
  id?: number;
  code?: string;
  name?: string;
  coverImageKey?: string;
};

export type TodayCategoryGroup = {
  categoryId?: number;
  name?: string;
  routines?: TodayRoutineItem[];
  todos?: TodayTodoItem[];
};

export type TodayResponse = {
  date?: string;
  categories?: TodayCategoryGroup[];
  summary?: TodaySummary;
  streak?: TodayStreak;
};

export type TodayRoutineItem = {
  id?: number;
  title?: string;
  scheduledTime?: string;
  authType?: 'CHECK' | 'PHOTO';
  completed?: boolean;
};

export type TodayStreak = {
  currentCount?: number;
  longestCount?: number;
  lastSuccessDate?: string;
};

export type TodaySummary = {
  completedCount?: number;
  remainingCount?: number;
  progressRate?: number;
};

export type TodayTodoItem = {
  id?: number;
  title?: string;
  dueDate?: string;
  status?: 'PENDING' | 'COMPLETED';
  completedAt?: string;
};

export type TodoCompleteResponse = {
  id?: number;
  status?: 'PENDING' | 'COMPLETED';
  completedAt?: string;
  rewardCurrencyType?: 'COIN' | 'DIAMOND';
  rewardAmount?: number;
};

export type TodoCreateRequest = {
  title: string;
  description?: string;
  categoryId?: number;
  dueDate?: string;
};

export type TodoListResponse = {
  items?: TodoResponse[];
};

export type TodoResponse = {
  id?: number;
  title?: string;
  description?: string;
  categoryId?: number;
  dueDate?: string;
  status?: 'PENDING' | 'COMPLETED';
  completedAt?: string;
};

export type TodoUpdateRequest = {
  title?: string;
  description?: string;
  categoryId?: number;
  dueDate?: string;
};

export type TokenResponse = {
  accessToken?: string;
  refreshToken?: string;
};

export type TransferOwnershipRequest = {
  targetMembershipId: number;
};

export type TransferOwnershipResponse = {
  houseId?: number;
  newOwnerMembershipId?: number;
  newOwnerUserId?: number;
};

export type WalletListResponse = {
  items?: WalletResponse[];
};

export type WalletResponse = {
  currencyType?: 'COIN' | 'DIAMOND';
  balance?: number;
};

export type WalletSummary = {
  currencyType?: 'COIN' | 'DIAMOND';
  balance?: number;
};
