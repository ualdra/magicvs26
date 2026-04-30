export enum GamePhase {
  MULLIGAN = 'MULLIGAN',
  MULLIGAN_DECIDING = 'MULLIGAN_DECIDING',
  UNTAP = 'UNTAP',
  UPKEEP = 'UPKEEP',
  DRAW = 'DRAW',
  MAIN_1 = 'MAIN 1',
  COMBAT = 'COMBAT',
  MAIN_2 = 'MAIN 2',
  END = 'END'
}

export type AnimationStatus = 'IDLE' | 'SHUFFLING' | 'DEALING';

export interface GameCard {
  id: string;
  name: string;
  imageUrl: string;
  isTapped: boolean;
  type?: string;
  manaCost?: string[];
  power?: string;
  toughness?: string;
  producedMana?: string[];
  oracleText?: string;
  isAttacking?: boolean;
  isBlocking?: boolean;
  blockingTargetId?: string;
  enteredFieldTurn?: number;
  damageTaken?: number;
  orderedBlockers?: string[];
}

export interface ManaPool {
  white: number;
  blue: number;
  black: number;
  red: number;
  green: number;
  colorless: number;
}

export interface PlayerGameState {
  id: string;
  username: string;
  avatarUrl?: string;
  hp: number;
  library: GameCard[];
  hand: GameCard[];
  field: GameCard[];
  graveyard: GameCard[];
  libraryCount: number;
  graveyardCount: number;
  handCount: number;
  mulliganCount: number;
  isReady: boolean;
  manaPool: ManaPool;
}

export interface StackItem {
  id: string;
  sourceCardId: string;
  controllerId: string;
  type: 'SPELL' | 'ABILITY' | 'TRIGGER';
  name: string;
  card?: GameCard;
  imageUrl?: string;
  targetId?: string;
  targetType?: 'CREATURE' | 'PLAYER';
  effect?: any;
}

export interface GameState {
  matchId: string;
  turnCount: number;
  activePlayerId: string;
  priorityPlayerId: string;
  passedCount: number;
  stack: StackItem[];
  currentPhase: GamePhase;
  player1: PlayerGameState;
  player2: PlayerGameState;
  animationStatus: AnimationStatus;
  landsPlayedThisTurn: number;
  winnerId?: string;
  pendingManaChoice?: {
    playerId: string;
    cardId: string;
    options: string[];
  };
  pendingPayment?: {
    cardId: string;
    remainingGeneric: number;
    specificPaid: boolean;
  };
  pendingTarget?: {
    sourceCardId: string;
    validTargets: 'CREATURE' | 'PLAYER' | 'ANY';
    effect: 'DAMAGE' | 'DESTROY' | 'BUFF' | 'DEBUFF' | 'BOUNCE';
    value?: number;
  };
  pendingBlockerOrders?: {
    attackerId: string;
    blockerIds: string[];
  }[];
}
