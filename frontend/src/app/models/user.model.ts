export interface PublicUser {
  id: number;
  username: string;
  elo: number;
  avatarUrl?: string | null;
  isOnline?: boolean;
  lastSeenAt?: string | null;
}
