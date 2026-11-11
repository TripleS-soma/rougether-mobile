import { apiGetList, apiPost } from '@/api/client';

export type FeedAuthorHouse = {
  houseId: number;
  name: string;
  coverImageKey: string | null;
  level: number;
  displayMode: 'DIORAMA' | 'CLASSIC';
  isPublic: boolean;
  requiresApproval: boolean;
  currentMemberCount: number;
  maxMembers: number | null;
  isMember: boolean;
  isFull: boolean;
  myMembershipStatus: 'ACTIVE' | 'LEFT' | 'KICKED' | null;
  myJoinRequestStatus: 'PENDING' | 'REJECTED' | null;
  canJoin: boolean;
};

export type FeedHouseJoinResponse = {
  membershipId: number | null;
  houseId: number;
  status: 'ACTIVE' | null;
  pendingApproval: boolean;
  joinRequestId: number | null;
};

export function fetchFeedAuthorHouses(postId: number) {
  return apiGetList<FeedAuthorHouse>(`/feed/posts/${postId}/houses`);
}

export function joinFeedAuthorHouse(postId: number, houseId: number) {
  return apiPost<FeedHouseJoinResponse>(`/feed/posts/${postId}/houses/${houseId}/join`, undefined, {
    expectedStatuses: [404, 409],
  });
}
