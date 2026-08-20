/**
 * TypeScript types generated from the Rougether User API v1 OpenAPI spec
 * (https://dkfiwkal2ezg9.cloudfront.net/v3/api-docs). Regenerate with `npm run gen:api-types`. Do not edit by hand.
 */

export type AccessoryRenderProfileResponse = {
  renderState?: string;
  assetKey?: string;
  canvasWidth?: number;
  canvasHeight?: number;
  assetWidth?: number;
  assetHeight?: number;
  positionX?: number;
  positionY?: number;
  widthRatio?: number;
  rotationDeg?: number;
  zIndex?: number;
};

export type AppleLoginRequest = {
  idToken: string;
  authorizationCode: string;
};

export type AttendanceCheckInResponse = {
  newCheckIn?: boolean;
  coinRewardAmount?: number;
  coinBalance?: number;
  rewardGrantedNow?: boolean;
  status?: AttendanceEventStatusResponse;
};

export type AttendanceEventStatusResponse = {
  eventId?: number;
  code?: string;
  title?: string;
  startsOn?: string;
  endsOn?: string;
  targetDays?: number;
  currentStreak?: number;
  checkedInToday?: boolean;
  completed?: boolean;
  checkInDates?: string[];
  dailyRewards?: DailyReward[];
  reward?: Reward;
};

export type BugReportListResponse = {
  items?: BugReportResponse[];
};

export type BugReportResponse = {
  bugReportId?: number;
  title?: string;
  content?: string;
  status?: 'RECEIVED' | 'IN_PROGRESS' | 'RESOLVED';
  screenshotKeys?: string[];
  createdAt?: string;
};

export type CalendarDayCount = {
  date?: string;
  routineCount?: number;
  todoCount?: number;
};

export type CalendarDayResponse = {
  date?: string;
  categories?: TodayCategoryGroup[];
  summary?: TodaySummary;
};

export type CalendarMonthResponse = {
  yearMonth?: string;
  days?: CalendarDayCount[];
};

export type CategoryCreateRequest = {
  name: string;
  colorHex?: string;
  iconKey?: string;
  sortOrder?: number;
  visibility?: 'PRIVATE' | 'FRIENDS' | 'HOUSE' | 'PUBLIC';
  houseId?: number;
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
  visibility?: 'PRIVATE' | 'FRIENDS' | 'HOUSE' | 'PUBLIC';
  deleted?: boolean;
  // 스펙 미표기 nullable (#733): 미연동은 null (#578).
  houseId?: number | null;
};

export type CategoryUpdateRequest = {
  name?: string;
  colorHex?: string;
  iconKey?: string;
  sortOrder?: number;
  visibility?: 'PRIVATE' | 'FRIENDS' | 'HOUSE' | 'PUBLIC';
  houseId?: number;
};

export type CharacterAccessoriesResponse = {
  userCharacterId?: number;
  items?: EquippedAccessoryResponse[];
};

export type CharacterAccessoryEquipRequest = {
  userItemId: number;
};

export type CharacterAnimations = {
  idle?: string;
  poseCycle?: string;
  wave?: string;
};

export type CharacterItem = {
  id?: number;
  code?: string;
  name?: string;
  baseAssetKey?: string;
  animations?: CharacterAnimations;
  poses?: CharacterPoseResponse[];
  sortOrder?: number;
};

export type CharacterListResponse = {
  items?: CharacterItem[];
};

export type CharacterPoseResponse = {
  id?: number;
  code?: string;
  assetKey?: string;
  sortOrder?: number;
};

export type CharacterSelectRequest = {
  characterId: number;
};

export type CharacterSelectResponse = {
  selectedCharacterId?: number;
};

export type CompletionSummary = {
  routineDate?: string;
  completedAt?: string;
  routineId?: number;
  originRoutineId?: number;
  title?: string;
  categoryId?: number;
};

export type DailyReward = {
  day?: number;
  coinAmount?: number;
  furnitureReward?: boolean;
  claimed?: boolean;
};

export type DevLoginRequest = {
  userId?: number;
};

export type DeviceTokenRegisterRequest = {
  token: string;
  platform: 'IOS' | 'ANDROID';
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

export type EquippedAccessoryResponse = {
  userItemId?: number;
  itemId?: number;
  name?: string;
  assetKey?: string;
  characterSlotType?: string;
  renderProfiles?: AccessoryRenderProfileResponse[];
  equippedAt?: string;
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
  giftBoxAssetKey?: string;
  costCurrencyType?: 'COIN' | 'DIAMOND';
  costAmount?: number;
  drawCount?: number;
  active?: boolean;
};

export type GachaRewardListResponse = {
  items?: GachaRewardResponse[];
};

export type GachaRewardResponse = {
  rewardType?: string;
  itemId?: number;
  characterId?: number;
  name?: string;
  assetKey?: string;
  rarity?: string;
  owned?: boolean;
  categoryCode?: string;
  placementType?: string;
  surfaceSlotType?: string;
  characterSlotType?: string;
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

export type GuestbookCreateRequest = {
  houseId: number;
  content: string;
};

export type GuestbookCreateResponse = {
  guestbookId?: number;
  roomOwnerId?: number;
  authorId?: number;
  houseId?: number;
  content?: string;
  createdAt?: string;
};

export type GuestbookItem = {
  guestbookId?: number;
  authorId?: number;
  authorNickname?: string;
  content?: string;
  createdAt?: string;
  authorBot?: boolean;
};

export type GuestbookListResponse = {
  items?: GuestbookItem[];
  nextCursor?: number;
  hasNext?: boolean;
};

export type HouseCheerRequest = {
  type: string;
};

export type HouseCheerResponse = {
  cheerId?: number;
  houseId?: number;
  targetMembershipId?: number;
  targetUserId?: number;
  type?: string;
  cheerDate?: string;
};

export type HouseCoverImage = {
  code?: string;
  name?: string;
  coverImageKey?: string;
};

export type HouseCoverImageListResponse = {
  items?: HouseCoverImage[];
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

export type HouseJoinRequestListResponse = {
  items?: HouseJoinRequestResponse[];
};

export type HouseJoinRequestResponse = {
  requestId?: number;
  houseId?: number;
  userId?: number;
  nickname?: string;
  status?: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  requestedAt?: string;
};

export type HouseJoinResponse = {
  membershipId?: number;
  houseId?: number;
  status?: 'ACTIVE' | 'LEFT' | 'KICKED';
  pendingApproval?: boolean;
  joinRequestId?: number;
};

export type HouseListResponse = {
  items?: HouseSummary[];
  page?: number;
  size?: number;
  totalElements?: number;
};

export type HouseMemberDayResponse = {
  date?: string;
  routines?: MemberRoutineItem[];
  todos?: MemberTodoItem[];
  categories?: MemberCategoryItem[];
};

export type HouseMemberListResponse = {
  items?: MemberSummary[];
};

export type HouseMemberRoutineCompletionListResponse = {
  from?: string;
  to?: string;
  items?: CompletionSummary[];
};

export type HouseMissionClaimResponse = {
  missionId?: number;
  status?: 'ACTIVE' | 'COMPLETED' | 'EXPIRED';
  grantedGrowthPoints?: number;
  houseGrowthPoints?: number;
  houseLevel?: number;
};

export type HouseMissionContributeResponse = {
  missionId?: number;
  myContribution?: number;
  currentValue?: number;
  achieved?: boolean;
};

export type HouseMissionCreateRequest = {
  title: string;
  missionType: 'DAILY_MEMBER_RATE' | 'WEEKLY_MEMBER_COUNT' | 'STREAK_DAYS';
  targetValue?: number;
  startsAt?: string;
  endsAt?: string;
};

export type HouseMissionListResponse = {
  items?: MissionSummary[];
};

export type HouseMissionResponse = {
  missionId?: number;
  title?: string;
  missionType?: 'DAILY_MEMBER_RATE' | 'WEEKLY_MEMBER_COUNT' | 'STREAK_DAYS';
  targetValue?: number;
  currentValue?: number;
  status?: 'ACTIVE' | 'COMPLETED' | 'EXPIRED';
  startsAt?: string;
  endsAt?: string;
  myContribution?: number;
  achieved?: boolean;
  todayClaimed?: boolean;
  createdAt?: string;
};

export type HouseOrderUpdateRequest = {
  houseIds: number[];
};

export type HousePreviewDetailResponse = {
  houseId?: number;
  name?: string;
  description?: string;
  coverImageKey?: string;
  maxMembers?: number;
  currentMemberCount?: number;
  level?: number;
  goals?: GoalSummary[];
  isMember?: boolean;
  isFull?: boolean;
  myJoinRequestStatus?: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  missions?: MissionSummary[];
  memberRooms?: MemberRoomSummary[];
};

export type HousePreviewResponse = {
  houseId?: number;
  name?: string;
  coverImageKey?: string;
  currentMemberCount?: number;
  maxMembers?: number;
  inviteExpired?: boolean;
  requiresApproval?: boolean;
};

export type HouseSummary = {
  houseId?: number;
  name?: string;
  coverImageKey?: string;
  currentMemberCount?: number;
  maxMembers?: number;
  level?: number;
  goals?: GoalSummary[];
  myJoinRequestStatus?: 'PENDING' | 'ACCEPTED' | 'REJECTED';
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

export type InviteRedeemRequest = {
  code: string;
};

export type InviteRedeemResponse = {
  rewardCoin?: number;
  coinBalance?: number;
  inviterRewarded?: boolean;
};

export type Item = {
  date: string;
  title: string;
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
  defaultScale?: number;
  defaultPositionX?: number | null;
  defaultPositionY?: number | null;
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
  bio?: string;
  profileImageKey?: string;
  lastAccessedAt?: string;
  onboarding?: OnboardingSummary;
};

export type MemberCategoryItem = {
  id?: number;
  name?: string;
  colorHex?: string;
  iconKey?: string;
};

export type MemberRoomSummary = {
  membershipId?: number;
  nickname?: string;
  // 스펙 미표기 nullable (#733): 방을 아직 만들지 않은 구성원은 null — 기본 빈 방으로 렌더.
  room?: RoomRenderResponse | null;
};

export type MemberRoutineItem = {
  id?: number;
  originRoutineId?: number;
  title?: string;
  scheduledTime?: string;
  authType?: 'CHECK' | 'PHOTO';
  categoryId?: number;
  completed?: boolean;
};

export type MemberSummary = {
  membershipId?: number;
  userId?: number;
  nickname?: string;
  role?: 'OWNER' | 'MEMBER';
  status?: 'ACTIVE' | 'LEFT' | 'KICKED';
  joinedAt?: string;
  lastAccessedAt?: string;
  bot?: boolean;
};

export type MemberTodoItem = {
  id?: number;
  title?: string;
  status?: 'PENDING' | 'COMPLETED';
  completedAt?: string;
  categoryId?: number;
};

export type MemberUpdateRequest = {
  nickname: string;
  bio?: string;
};

export type MissionSummary = {
  missionId?: number;
  title?: string;
  missionType?: 'DAILY_MEMBER_RATE' | 'WEEKLY_MEMBER_COUNT' | 'STREAK_DAYS';
  targetValue?: number;
  currentValue?: number;
  status?: 'ACTIVE' | 'COMPLETED' | 'EXPIRED';
  startsAt?: string;
  endsAt?: string;
  todayClaimed?: boolean;
  createdAt?: string;
};

export type MyCharacterItem = {
  userCharacterId?: number;
  characterId?: number;
  code?: string;
  name?: string;
  baseAssetKey?: string;
  animations?: CharacterAnimations;
  poses?: CharacterPoseResponse[];
  selected?: boolean;
  accessories?: EquippedAccessoryResponse[];
  acquiredAt?: string;
};

export type MyCharacterListResponse = {
  items?: MyCharacterItem[];
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

export type MyInviteCodeResponse = {
  code?: string;
  rewardedCount?: number;
  inviterRewardCoin?: number;
  inviteeRewardCoin?: number;
  maxRewardedCount?: number;
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
  defaultScale?: number;
  defaultPositionX?: number | null;
  defaultPositionY?: number | null;
  theme?: ThemeSummary;
  acquiredAt?: string;
};

export type MyJoinRequestListResponse = {
  items?: MyJoinRequestSummary[];
};

export type MyJoinRequestSummary = {
  requestId?: number;
  houseId?: number;
  houseName?: string;
  coverImageKey?: string;
  goals?: GoalSummary[];
  status?: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  requestedAt?: string;
};

export type NotificationItem = {
  notificationId?: number;
  type?:
    | 'HOUSE_KICK'
    | 'ROUTINE_REMINDER'
    | 'TODO_REMINDER'
    | 'FRIEND_CHEER'
    | 'HOUSE_MISSION_ACHIEVED'
    | 'HOUSE_MEMBER_JOINED'
    | 'HOUSE_MEMBER_LEFT'
    | 'HOUSE_JOIN_REQUEST_REJECTED'
    | 'HOUSE_JOIN_REQUEST_ACCEPTED'
    | 'ROOM_COBWEB_CLEANED';
  title?: string;
  body?: string;
  isRead?: boolean;
  createdAt?: string;
};

export type NotificationListResponse = {
  items?: NotificationItem[];
  nextCursor?: number;
  hasNext?: boolean;
};

export type NotificationSettingResponse = {
  all?: boolean;
  reminder?: boolean;
  house?: boolean;
};

export type NotificationSettingUpdateRequest = {
  all?: boolean;
  reminder?: boolean;
  house?: boolean;
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

export type PlacementItem = {
  userItemId: number;
  positionX: number;
  positionY: number;
  zIndex?: number;
  scale?: number;
  rotationDeg?: number;
  flipped?: boolean;
};

export type ProfileImageResponse = {
  profileImageKey?: string;
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

export type RenderAccessory = {
  itemId?: number;
  name?: string;
  assetKey?: string;
  characterSlotType?: string;
  renderProfiles?: AccessoryRenderProfileResponse[];
};

export type RenderCharacter = {
  characterId?: number;
  code?: string;
  name?: string;
  assetKey?: string;
  animations?: CharacterAnimations;
  accessories?: RenderAccessory[];
};

export type RenderPlacement = {
  assetKey?: string;
  positionX?: number;
  positionY?: number;
  zIndex?: number;
  scale?: number;
  rotationDeg?: number;
  flipped?: boolean;
};

export type RenderSlot = {
  slotType?: string;
  assetKey?: string;
};

export type RepeatDays = {
  daysOfWeek?: string[];
  dayOfMonth?: number;
  month?: number;
  day?: number;
};

export type Reward = {
  itemId?: number;
  name?: string;
  assetKey?: string;
  userItemId?: number;
  received?: boolean;
};

export type RoomCharacterResponse = {
  characterId?: number;
  code?: string;
  name?: string;
  assetKey?: string;
  animations?: CharacterAnimations;
  accessories?: EquippedAccessoryResponse[];
};

export type RoomCobwebCleanResponse = {
  roomUserId?: number;
  cleanedAt?: string;
  rewardCurrencyType?: 'COIN' | 'DIAMOND';
  rewardAmount?: number;
  balance?: number;
};

export type RoomCobwebResponse = {
  assetKey?: string;
  appearedAt?: string;
  cleanable?: boolean;
};

export type RoomLayoutUpdateRequest = {
  baseRevision: number;
  surfaceSlots: SurfaceSlotAssignment[];
  placements: PlacementItem[];
};

export type RoomPlacementResponse = {
  userItemId?: number;
  assetKey?: string;
  positionX?: number;
  positionY?: number;
  zIndex?: number;
  scale?: number;
  rotationDeg?: number;
  flipped?: boolean;
  updatedAt?: string;
};

export type RoomRenderResponse = {
  growthLevel?: number;
  layoutFormat?: 'SLOT_V1' | 'FREE_V1';
  character?: RenderCharacter;
  slots?: RenderSlot[];
  placements?: RenderPlacement[];
  cobweb?: RoomCobwebResponse;
};

export type RoomResponse = {
  roomUserId?: number;
  growthLevel?: number;
  layoutFormat?: 'SLOT_V1' | 'FREE_V1';
  layoutRevision?: number;
  character?: RoomCharacterResponse;
  slots?: RoomSlotResponse[];
  placements?: RoomPlacementResponse[];
  streak?: RoomStreakResponse;
  cobweb?: RoomCobwebResponse;
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
  houseMissionId?: number;
  externalSource?: string;
  externalId?: string;
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
  status?: 'PENDING' | 'COMPLETED' | 'FAILED';
  completedAt?: string;
  rewardCurrencyType?: 'COIN' | 'DIAMOND';
  rewardAmount?: number;
  streak?: StreakSummaryResponse;
  // 스펙 미표기 nullable (#733): null이면 미연동/스킵(이미 기여·비활성·과거 등) (#578).
  houseMissionContribution?: HouseMissionContributeResponse | null;
};

export type RoutineResponse = {
  id?: number;
  title?: string;
  categoryId?: number;
  authType?: 'CHECK' | 'PHOTO';
  status?: 'ACTIVE';
  repeatType?: string;
  repeatDays?: RepeatDays;
  scheduledTime?: string;
  startsOn?: string;
  endsOn?: string;
  originRoutineId?: number;
  // 스펙 미표기 nullable (#733): 미연동 루틴은 null로 온다.
  houseMissionId?: number | null;
  externalSource?: string;
  externalId?: string;
};

export type RoutineStatResponse = {
  lineageId?: number;
  title?: string;
  categoryName?: string;
  completed?: number;
  failed?: number;
};

export type RoutineUpdateRequest = {
  title?: string;
  categoryId?: number;
  authType?: 'CHECK' | 'PHOTO';
  repeatType?: string;
  // 스펙 미표기 nullable (#733): null은 "지우기" — WEEKLY→DAILY 전환.
  repeatDays?: RepeatDays | null;
  // 스펙 미표기 nullable (#733): null은 "지우기" — 알람 해제.
  scheduledTime?: string | null;
  startsOn?: string;
  // 스펙 미표기 nullable (#733): null은 "지우기" — 종료일 해제.
  endsOn?: string | null;
  // 스펙 미표기 nullable (#733): 요청·응답 모두 null이 올 수 있어 타입만 넓힌다. **null은 "해제"가 아니라 "기존 유지"** (2026-08-19 스웨거 확인, #907) — 연동 해제는 DELETE /routines/{id}/house-mission-link 로만 된다. 카테고리의 houseId도 같은 규칙.
  houseMissionId?: number | null;
};

export type SimilarityRequest = {
  items: Item[];
};

export type SimilarityResponse = {
  embeddingApplied?: boolean;
  items?: Item[];
};

export type SlotAssignment = {
  slotType: string;
  userItemId?: number;
};

export type StreakResponse = {
  currentCount?: number;
  longestCount?: number;
};

export type StreakSummaryResponse = {
  currentCount?: number;
  longestCount?: number;
  lastSuccessDate?: string;
};

export type SurfaceSlotAssignment = {
  slotType: string;
  userItemId?: number;
};

export type ThemeSummary = {
  id?: number;
  code?: string;
  name?: string;
  coverImageKey?: string;
};

export type TodayCategoryGroup = {
  categoryId?: number;
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
  houseMissionId?: number;
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
  dueTime?: string;
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
  dueTime?: string;
  externalSource?: string;
  externalId?: string;
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
  dueTime?: string;
  status?: 'PENDING' | 'COMPLETED';
  completedAt?: string;
  externalSource?: string;
  externalId?: string;
};

export type TodoUpdateRequest = {
  title?: string;
  description?: string;
  categoryId?: number;
  dueDate?: string;
  dueTime?: string;
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

export type WalletHistoryListResponse = {
  items?: WalletHistoryResponse[];
  page?: number;
  size?: number;
  totalElements?: number;
};

export type WalletHistoryResponse = {
  id?: number;
  currencyType?: 'COIN' | 'DIAMOND';
  amount?: number;
  reason?:
    | 'ROUTINE_COMPLETE'
    | 'TODO_COMPLETE'
    | 'SIGNUP_BONUS'
    | 'GACHA_DUPLICATE_CONVERT'
    | 'INVITE_REWARD'
    | 'COBWEB_CLEAN'
    | 'ATTENDANCE_REWARD'
    | 'GACHA_DRAW'
    | 'SHOP_PURCHASE';
  balanceAfter?: number;
  createdAt?: string;
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

export type WeekdayStatResponse = {
  dayOfWeek?: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
  completed?: number;
  failed?: number;
};

export type WeeklyReportDetailResponse = {
  reportId?: number;
  weekStartDate?: string;
  weekEndDate?: string;
  status?: 'GENERATED' | 'FALLBACK';
  completionRate?: number;
  completedCount?: number;
  scheduledCount?: number;
  summary?: string;
  generatedAt?: string;
  stats?: WeeklyStatsResponse;
  highlights?: string[];
  failurePatterns?: string[];
  suggestions?: string[];
};

export type WeeklyReportListResponse = {
  items?: WeeklyReportSummaryItem[];
};

export type WeeklyReportSummaryItem = {
  reportId?: number;
  weekStartDate?: string;
  weekEndDate?: string;
  status?: 'GENERATED' | 'FALLBACK';
  completionRate?: number;
  completedCount?: number;
  scheduledCount?: number;
  summary?: string;
  generatedAt?: string;
};

export type WeeklyStatsResponse = {
  scheduledCount?: number;
  completedCount?: number;
  failedCount?: number;
  completionRate?: number;
  byWeekday?: WeekdayStatResponse[];
  byRoutine?: RoutineStatResponse[];
  streak?: StreakResponse;
};
