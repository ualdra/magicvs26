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
  attackingTargetId?: string; // ID del jugador o permanente (Planeswalker/Batalla) al que ataca
  isBlocking?: boolean;
  blockingTargetId?: string;
  enteredFieldTurn?: number;
  damageTaken?: number;
  orderedBlockers?: string[];

  // Propiedades avanzadas para mecánicas core
  isToken?: boolean;
  isDoubleFaced?: boolean;
  currentFaceIndex?: number; // 0: Frontal, 1: Posterior
  imageUrl2?: string;
  faces?: {
    name: string;
    manaCost: string[];
    type: string;
    oracleText: string;
    powerToughness?: string;
    imageUrl: string;
  }[];
  counters?: Record<string, number>; // Ej: { "+1/+1": 2, "charge": 3 }
  attachedToCardId?: string;
  attachedCardIds?: string[];
  tempPowerModifier?: number;
  tempToughnessModifier?: number;
  crewed?: boolean;
  hasSummoningSickness?: boolean;
  exileOnResolution?: boolean; // Para hechizos lanzados con Flashback/Escape
  tempUnblockable?: boolean; // Sprint 7
  loyaltyUsedThisTurn?: boolean; // Caminante de planos
  battleProtectorId?: string; // ID del oponente que protege la batalla
  isBattle?: boolean; // Tipo Batalla
  isPlaneswalker?: boolean; // Tipo Caminante de planos
  isSaga?: boolean; // Tipo Saga
  
  // Adventure
  isAdventure?: boolean;
  adventureName?: string;
  adventureManaCost?: string[];
  adventureType?: string;
  adventureOracleText?: string;
  adventureExiled?: boolean;
  castAsAdventure?: boolean;

  // Disturb
  hasDisturb?: boolean;
  disturbCost?: string[];
  disturbExileOnLeave?: boolean;

  // MDFC
  isMdfc?: boolean;
  mdfcFaceSelected?: number; 
  hasIncubateTransform?: boolean;
  canTransform?: boolean;

  // SPRINT 14: Boast & Combat
  hasAttackedThisTurn?: boolean;
  boastActivatedThisTurn?: boolean;

  // Bestow (Concesión)
  castAsBestow?: boolean;

  // Foretell & Plot
  isForetold?: boolean;
  isPlotted?: boolean;
  foretellTurn?: number;
  castAsForetold?: boolean;
  castAsPlot?: boolean;
  isBloodToken?: boolean;
  
  // Disguise, Cloak & Suspect
  isFaceDown?: boolean;
  isDisguised?: boolean;
  isCloaked?: boolean;
  disguiseCost?: string[];
  isSuspected?: boolean;
  originalCardData?: any;

  // Warp
  castAsWarped?: boolean;
  warpedFromExile?: boolean;

  // Exhaust — habilidades que solo se usan 1 vez
  exhaustUsed?: boolean;

  // Mobilize — puede atacar como con prisa mientras dura el efecto
  mobilizeActive?: boolean;

  // Saddle — como Crew para Mounts
  isSaddled?: boolean;

  // Animated Land
  isAnimated?: boolean;
  originalLandType?: string;
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
  exile: GameCard[]; // Zona de Exilio
  libraryCount: number;
  graveyardCount: number;
  exileCount: number; // Contador de cartas en Exilio
  handCount: number;
  mulliganCount: number;
  isReady: boolean;
  manaPool: ManaPool;
  poisonCounters?: number; // Contadores de veneno (Sprint 12)
  speed?: number; // Start your engines! — 0..4
  maxSpeedReached?: boolean;
  dealtDamageThisTurn?: boolean; // Daño infligido este turno
  dealtDamageLastTurn?: boolean; // Daño infligido el turno anterior (velocidad)
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
  targetType?: 'CREATURE' | 'PLAYER' | 'SPELL_ON_STACK';
  effect?: any;
  kicked?: boolean; // Indica si se pagó Estímulo
}

export interface AnimationEvent {
  id: string;
  cardId: string;
  type: 'landfall' | 'death' | 'flicker' | 'reanimate' | 'fight' | 'counter_plus1' | 'stun' | 'speed_up' | 'token_create' | 'aura_equip' | 'bargain_sac' | 'gift' | 'plot' | 'cycling' | 'activate_ability' | 'sparkle' | 'blink' | 'portal' | 'ascend' | 'disintegrate';
  duration: number;
  sourceCardId?: string;
  message?: string;
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
    convokeActive?: boolean;
    tappedConvokeCreatureIds?: string[];
    remainingColored?: { white: number; blue: number; black: number; red: number; green: number };
    delveActive?: boolean;
    exilingForDelveCount?: number;
    manaSnapshot?: ManaPool;
  };
  pendingChannelChoice?: {
    cardId: string;
    channelCost: string[];
  };
  pendingTarget?: {
    sourceCardId: string;
    validTargets: 'CREATURE' | 'PLAYER' | 'ANY' | 'SPELL_ON_STACK' | 'MY_CREATURE';
    effect: string;
    value?: number;
  };
  pendingKickerChoice?: {
    cardId: string;
    kickerCost: string[];
  };
  pendingDiscard?: {
    count: number;
    triggerTargetId?: string; // Para Connive
    forConnive?: boolean;
  };
  pendingDiscoverChoice?: {
    playerId: string;
    cardsRevealed: GameCard[];
    foundCard: GameCard | null;
    isCascade: boolean;
    manaValueLimit: number;
  };
  pendingWardChoice?: {
    targetCardId: string;
    sourceCardId: string;
    wardCost: string[];
    selectedTargetId: string;
    selectedTargetType: 'CREATURE' | 'PLAYER' | 'SPELL_ON_STACK';
  };
  pendingScrySurveilChoice?: {
    playerId: string;
    type: 'SCRY' | 'SURVEIL';
    cards: GameCard[];
    value: number;
    sourceCardId: string;
  };
  pendingCrewChoice?: {
    vehicleId: string;
    requiredPower: number;
    tappedCreatureIds: string[];
  };
  pendingSacrificeChoice?: {
    playerId: string;
    count: number;
    validTypes: 'CREATURE' | 'PERMANENT';
    sourceCardId?: string;
    isExploitSacrifice?: boolean;
  };
  pendingGraveyardSelection?: {
    playerId: string;
    effectType: 'EXILE' | 'RETURN_TO_HAND';
    sourceCardId?: string;
  };
  pendingBlockerOrders?: {
    attackerId: string;
    blockerIds: string[];
  }[];
  pendingPlaneswalkerChoice?: {
    planeswalkerId: string;
    abilities: string[];
  };
  pendingAdventureChoice?: {
    cardId: string;
    creatureCost: string[];
    adventureCost: string[];
    adventureName: string;
  };
  pendingMdfcChoice?: {
    cardId: string;
    face0Name: string;
    face1Name: string;
    face0Cost: string[];
    face1Cost: string[];
    face0Type: string;
    face1Type: string;
  };
  pendingBestowChoice?: {
    cardId: string;
    creatureCost: string[];
    bestowCost: string[];
    bestowName: string;
  };
  pendingForetellChoice?: {
    cardId: string;
    normalCost: string[];
    foretellCost: string[];
  };
  pendingPlotChoice?: {
    cardId: string;
    normalCost: string[];
    plotCost: string[];
  };
  pendingExploitChoice?: {
    cardId: string;
    creatureName: string;
  };
  pendingDisguiseChoice?: {
    cardId: string;
    normalCost: string[];
    disguiseCost: string[];
  };
  pendingSpreeChoice?: {
    cardId: string;
    spreeOptions: { cost: string[], text: string }[];
  };
  pendingSquadChoice?: {
    cardId: string;
    squadCost: string[];
  };
  pendingOffspringChoice?: {
    cardId: string;
    offspringCost: string[];
  };
  pendingEnlistChoice?: {
    attackerId: string;
    validEnlisters: string[];
  };
  pendingBargainChoice?: {
    cardId: string;
    bargainEffect: string;
  };
  pendingGiftChoice?: {
    cardId: string;
    giftDescription: string;
  };
  pendingImpendingChoice?: {
    cardId: string;
    impendingCount: number;
    normalCost: string[];
    impendingCost: string[];
    impendingEffect: string;
  };
  pendingWarpChoice?: {
    cardId: string;
    normalCost: string[];
    warpCost: string[];
  };
  pendingOptionalPayChoice?: {
    cardId: string;
    cost: string[];
    description: string;
    onPay: { effectType: 'TAP_STUN'; validTargets: 'CREATURE' };
    onDecline: string;
  };
  pendingPayLifeChoice?: {
    cardId: string;
    lifeCost: number;
    description: string;
  };
  pendingAnimateChoice?: {
    sourceCardId: string;
    count: number;
    selectedLandIds: string[];
    playerId?: string;
  };
  pendingXChoice?: {
    cardId: string;
    baseCost: string[];
  };
  pendingFightChoice?: {
    sourceCardId: string;
    myCreatureId?: string;
  };
  pendingActivatedAbility?: {
    cardId: string;
    abilityIndex: number;
    costMana: string[];
    needsTap: boolean;
    needsSacrifice: boolean;
    effectType: 'SEARCH_LAND' | 'ANIMATE_LAND' | 'EXILE_GY' | 'UNBLOCKABLE' | 'SEARCH_LAND_UNTAP' | 'GIVE_INDESTRUCTIBLE';
    targetCount?: number;
  };
  pendingModalChoice?: {
    cardId: string;
    modeCount: number;
    modes: { text: string; effect: string }[];
    playerId?: string;
  };
  combatStep?: 'BEGIN' | 'ATTACKERS' | 'BLOCKERS' | 'FIRST_STRIKE_DAMAGE' | 'NORMAL_DAMAGE' | 'END';
  actionLog?: string[];
  animationEvents?: AnimationEvent[];
  
  // Daybound/Nightbound Cycle
  timeCycle?: 'NONE' | 'DAY' | 'NIGHT';
  spellsCastThisTurn?: { [playerId: string]: number };
}
