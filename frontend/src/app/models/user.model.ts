export interface PublicUser {
  id: number;
  username: string;
  elo: number;
  friendTag?: string;
  avatarUrl?: string | null;
  bio?: string;
  stats?: {
    matchesPlayed: number;
    winRate: number;
    wins: number;
    losses: number;
    tournamentsWon: number;
    globalRank: number;
  };
  decks?: Array<{
    id: number;
    name: string;
    format: string;
    totalCards: number;
    colors: string[];
    imageUrl: string | null;
  }>;
  isOnline?: boolean;
  lastSeenAt?: string | null;
}
