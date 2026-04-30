export type MatchStatus = 'LIVE' | 'WAITING' | 'FINISHED';

export interface DeckSummary {
  archetype: string;
  colors: string[]; // e.g. ['W', 'U']
  name?: string;
}

export interface MatchPlayer {
  username: string;
  elo: number;
  avatarUrl?: string;
  deckSummary?: DeckSummary;
}

export interface Match {
  id: string;
  status: MatchStatus;
  format: string;
  player1: MatchPlayer;
  player2?: MatchPlayer;
  winner?: string;
  score?: string;
  eloChange?: number; // For History section
  timestamp?: string; // For sorting history
}
