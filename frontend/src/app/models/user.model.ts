export interface PublicUser {
  id: number;
  username: string;
  elo: number;
  avatarUrl?: string | null;
  bio?: string;
  stats?: {
    matchesPlayed: number;
    winRate: number;
    tournamentsWon: number;
    globalRank: number;
  };
  decks?: Array<{
    id: number;
    name: string;
    format: string;
    colors: string[];
    imageUrl: string | null;
  }>;
}

export type User = PublicUser;
