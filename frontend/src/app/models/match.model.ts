export type MatchStatus = 'LIVE' | 'WAITING' | 'FINISHED';

export interface DeckSummary {
  archetype: string;
  colors: string[];
  name?: string;
  cardNames?: string[];
  mainImageUrl?: string;
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
  eloChange?: number;
  timestamp?: string;
  deck1?: DeckSummary;
  deck2?: DeckSummary;
}
