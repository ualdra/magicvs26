import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, interval, Subscription } from 'rxjs';
import { GameState, GamePhase, GameCard, PlayerGameState, ManaPool, AnimationStatus, StackItem } from '../../models/game.model';
import { BattleService } from './battle.service';
import { NotificationService } from './notification.service';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root'
})
export class BattleEngineService {
  private gameStateSubject = new BehaviorSubject<GameState | null>(null);
  public gameState$ = this.gameStateSubject.asObservable();
  private pollSubscription: Subscription | null = null;
  private isProcessing = false;
  private selectedBlockerId: string | null = null;
  private syncInterval: any;

  constructor(
    private battleService: BattleService,
    private userService: UserService,
    private notificationService: NotificationService
  ) {}

  /**
   * Helper to get the local player state
   */
  public me(): PlayerGameState | null {
    const state = this.gameStateSubject.value;
    if (!state) return null;
    const myId = this.userService.getCurrentUser()?.id?.toString();
    return state.player1.id === myId ? state.player1 : state.player2;
  }

  /**
   * Helper to get the opponent player state
   */
  public opponent(): PlayerGameState | null {
    const state = this.gameStateSubject.value;
    if (!state) return null;
    const myId = this.userService.getCurrentUser()?.id?.toString();
    return state.player1.id === myId ? state.player2 : state.player1;
  }

  /**
   * Initializes the local state machine with data from backend
   */
  initialize(initialState: GameState): void {
    if (!initialState) return;
    const state = JSON.parse(JSON.stringify(initialState)); 
    const myId = this.userService.getCurrentUser()?.id?.toString() || '';
    
    const isP1Me = state.player1.id === myId;
    const me = isP1Me ? state.player1 : state.player2;

    if (me.hand.length === 0 && state.currentPhase === GamePhase.UNTAP) {
      [state.player1, state.player2].forEach(p => {
        const allCards = [...p.library, ...p.hand, ...p.field];
        p.library = allCards;
        p.hand = [];
        p.field = [];
        p.libraryCount = allCards.length;
        p.handCount = 0;
        p.mulliganCount = 0;
        p.isReady = false;
        p.manaPool = this.createEmptyManaPool();
      });
      if (!state.activePlayerId) {
        state.activePlayerId = state.player1.id;
      }
      state.currentPhase = GamePhase.MULLIGAN_DECIDING;
      state.turnCount = 1;
    }

    state.animationStatus = 'IDLE';
    state.landsPlayedThisTurn = state.landsPlayedThisTurn || 0;
    
    // Ensure stack and priority fields exist
    state.stack = state.stack || [];
    state.passedCount = state.passedCount || 0;
    state.priorityPlayerId = state.priorityPlayerId || state.activePlayerId;

    this.gameStateSubject.next(state);
    this.startPolling(state.matchId);
  }

  private startPolling(matchId: string): void {
    if (this.pollSubscription) this.pollSubscription.unsubscribe();
    
    this.pollSubscription = interval(1000).subscribe(() => {
      this.pollState(matchId);
    });
  }

  private pollState(matchId: string): void {
    const state = this.gameStateSubject.value;
    if (!state || this.isProcessing) return;

    this.battleService.getBattleState(matchId).subscribe({
      next: (remoteState) => {
        if (!this.isProcessing) {
          this.gameStateSubject.next(remoteState);
        }
      }
    });
  }

  stopPolling(): void {
    this.pollSubscription?.unsubscribe();
  }

  async startGame(): Promise<void> {
    const state = this.gameStateSubject.value;
    if (!state) return;
    const myId = this.userService.getCurrentUser()?.id?.toString();

    // LEAD PLAYER LOGIC
    if (state.player1.id != myId || state.currentPhase !== GamePhase.UNTAP || state.animationStatus !== 'IDLE' || this.isProcessing) {
       return;
    }

    try {
      this.isProcessing = true;
      this.updateState({ animationStatus: 'SHUFFLING' as AnimationStatus }, true);
      this.shuffle(state.player1.library);
      this.shuffle(state.player2.library);
      await this.delay(2000);

      let finalState = { ...state };
      if (state.player1.hand.length === 0) {
        let currentState = { ...state, animationStatus: 'DEALING' as AnimationStatus };
        this.gameStateSubject.next(currentState);
        
        for (let i = 0; i < 7; i++) {
          currentState = this.drawCard(currentState, currentState.player1.id);
          currentState = this.drawCard(currentState, currentState.player2.id);
          this.gameStateSubject.next(currentState);
          await this.delay(300);
        }
        finalState = currentState;
      }

      this.updateState({ ...finalState, animationStatus: 'IDLE' as AnimationStatus, currentPhase: GamePhase.MULLIGAN_DECIDING }, true);
    } catch (error) {
      console.error('Error starting game:', error);
      this.updateState({ animationStatus: 'IDLE' }, true);
    } finally {
      this.isProcessing = false;
    }
  }

  async takeMulligan(): Promise<void> {
    const p = this.me();
    if (!p) return;

    this.isProcessing = true;
    p.mulliganCount++;
    p.library.push(...p.hand);
    p.hand = [];
    p.handCount = 0;
    this.shuffle(p.library);
    p.libraryCount = p.library.length;
    p.isReady = false;

    const state = this.gameStateSubject.value;
    if (!state) {
      this.isProcessing = false;
      return;
    }
    let currentState = { ...state, animationStatus: 'DEALING' as AnimationStatus };
    this.gameStateSubject.next(currentState);

    for (let i = 0; i < 7; i++) {
      currentState = this.drawCard(currentState, p.id);
      this.gameStateSubject.next(currentState);
      await this.delay(300);
    }
    
    this.isProcessing = false;
    this.updateState({ ...currentState, animationStatus: 'IDLE' as AnimationStatus, currentPhase: GamePhase.MULLIGAN_DECIDING }, true);
  }

  keepHand(): void {
    const p = this.me();
    if (!p) return;

    if (p.mulliganCount === 0) {
      p.isReady = true;
      this.checkMulliganCompletion();
    } else {
      this.updateState({ currentPhase: GamePhase.MULLIGAN });
    }
  }

  dropCardToBottom(cardId: string): void {
    const p = this.me();
    if (!p) return;

    const cardIndex = p.hand.findIndex(c => c.id === cardId);
    if (cardIndex !== -1) {
      const card = p.hand.splice(cardIndex, 1)[0];
      p.library.push(card); 
      p.libraryCount = p.library.length;
      p.handCount = p.hand.length;

      const cardsToDrop = p.mulliganCount;
      if (p.hand.length === (7 - cardsToDrop)) {
        p.isReady = true;
        this.checkMulliganCompletion();
      } else {
        this.updateState({});
      }
    }
  }

  private checkMulliganCompletion(): void {
    const state = this.gameStateSubject.value;
    if (!state) return;

    if (state.player1.isReady && state.player2.isReady) {
      // Start the very first turn in MAIN 1
      this.updateState({ 
        currentPhase: GamePhase.MAIN_1,
        priorityPlayerId: state.activePlayerId,
        passedCount: 0
      });
      this.isProcessing = false;
    } else {
      this.updateState({}); 
    }
  }

  nextPhase(): void {
    const state = this.gameStateSubject.value;
    if (!state || (state.pendingBlockerOrders?.length || 0) > 0) return;

    if (state.stack.length > 0) {
      this.notificationService.showToast('La pila no está vacía', 'Debes esperar a que se resuelvan todos los efectos.', 'WARNING');
      return;
    }

    this.isProcessing = true;

    const phases = Object.values(GamePhase);
    const currentIndex = phases.indexOf(state.currentPhase);
    let nextIndex = currentIndex + 1;

    // Handle Combat Resolution if leaving COMBAT phase
    if (state.currentPhase === GamePhase.COMBAT) {
      const paused = this.resolveCombat();
      if (paused) {
        this.isProcessing = false;
        return;
      }
    }

    // Cleanup check: Cannot leave END phase with > 7 cards
    if (state.currentPhase === GamePhase.END) {
      const activePlayer = state.activePlayerId === state.player1.id ? state.player1 : state.player2;
      if (activePlayer.hand.length > 7) {
        this.notificationService.showToast('Límite de mano', `El jugador activo (${activePlayer.username}) debe descartar hasta tener 7.`, 'WARNING');
        this.isProcessing = false;
        return;
      }
    }

    if (nextIndex >= phases.length) {
      this.rotateTurn();
    } else {
      const nextPhase = phases[nextIndex] as GamePhase;

      let newState = { ...state };
      newState.currentPhase = nextPhase;

      // Reset combat states when leaving combat
      if (nextPhase === GamePhase.MAIN_2 || nextPhase === GamePhase.END) {
        [newState.player1, newState.player2].forEach(p => {
          p.field = p.field.map(c => ({
            ...c,
            isAttacking: false,
            isBlocking: false,
            blockingTargetId: undefined
          }));
        });
      }
      
      // Clear mana
      newState.player1 = { ...newState.player1, manaPool: this.createEmptyManaPool() };
      newState.player2 = { ...newState.player2, manaPool: this.createEmptyManaPool() };

      // Priority resets to Active Player on phase change
      newState.priorityPlayerId = newState.activePlayerId;
      newState.passedCount = 0;

      // Automatic actions
      newState = this.processAutomaticPhaseActions(newState, nextPhase);

      this.updateState(newState, true, () => {
        this.isProcessing = false;
      });
    }
  }

  forceNextPhase(): void {
    const state = this.gameStateSubject.value;
    if (!state || (state.pendingBlockerOrders?.length || 0) > 0) return;
    
    const myId = this.userService.getCurrentUser()?.id?.toString();
    if (state.activePlayerId !== myId) {
      this.notificationService.showToast('Acción no permitida', 'Solo el jugador activo puede forzar el cambio de fase.', 'ERROR');
      return;
    }
    this.notificationService.showToast('Forzando fase', 'Saltando validaciones...', 'INFO');
    this.isProcessing = false;
    this.nextPhase();
  }

  public getIsProcessing(): boolean {
    return this.isProcessing;
  }

  passPriority(): void {
    const state = this.gameStateSubject.value;
    if (!state || this.isProcessing) return;

    const myId = this.userService.getCurrentUser()?.id?.toString();
    const currentPriorityId = state.priorityPlayerId || state.activePlayerId;

    if (currentPriorityId !== myId) {
      this.notificationService.showToast('No tienes la prioridad', 'Debes esperar a que el rival pase prioridad.', 'WARNING');
      return;
    }

    console.log(`Priority Action: ${myId} is passing. Stack size: ${state.stack.length}, Current Passes: ${state.passedCount}`);
    this.isProcessing = true;
    const nextPriorityPlayerId = currentPriorityId === state.player1.id ? state.player2.id : state.player1.id;
    
    const newPassedCount = (state.passedCount || 0) + 1;

    if (newPassedCount >= 2) {
      // Rule: Cannot leave END phase with > 7 cards
      if (state.currentPhase === GamePhase.END) {
        const activePlayer = state.activePlayerId === state.player1.id ? state.player1 : state.player2;
        if (activePlayer.hand.length > 7) {
          const currentUserId = this.userService.getCurrentUser()?.id?.toString();
          if (state.activePlayerId === currentUserId) {
            this.notificationService.showToast('Límite de mano', 'Debes descartar cartas hasta tener 7 antes de terminar tu turno.', 'WARNING');
          } else {
            this.notificationService.showToast('Esperando descarte', `El rival (${activePlayer.username}) debe descartar cartas.`, 'INFO');
          }
          this.isProcessing = false;
          // Reset passes so they must pass again after discard
          this.updateState({ passedCount: 0 }, true);
          return;
        }
      }

      console.log("-> Ambos han pasado. Resolviendo...");
      if (state.stack.length > 0) {
        this.resolveTopStackItem(state);
      } else {
        this.nextPhase();
      }
    } else {
      console.log(`-> Un pase registrado. Prioridad para: ${nextPriorityPlayerId}`);
      this.updateState({ 
        priorityPlayerId: nextPriorityPlayerId,
        passedCount: newPassedCount
      }, true, () => {
        this.isProcessing = false;
      });
    }
  }

  private resolveTopStackItem(state: GameState): void {
    const stack = [...state.stack];
    const item = stack.pop();
    if (!item) return;

    state.stack = stack;
    this.notificationService.showToast('Resolviendo', `Se resuelve: ${item.name}`, 'INFO');
    
    // Reset priority to active player after resolution (Standard MTG rule)
    state.priorityPlayerId = state.activePlayerId;
    state.passedCount = 0; // Everyone must pass again

    // Execute effect
    this.applyResolvedEffect(item, state);

    this.updateState(state, true, () => {
      this.isProcessing = false;
    });
  }

  private applyResolvedEffect(item: StackItem, state: GameState): void {
    const controller = item.controllerId === state.player1.id ? state.player1 : state.player2;
    
    // Move card to final destination
    if (item.card) {
      const card = item.card;
      const isSpell = this.isSpell(card);
      
      if (card.type?.toLowerCase().includes('instant') || card.type?.toLowerCase().includes('sorcery') || 
          card.type?.toLowerCase().includes('instantáneo') || card.type?.toLowerCase().includes('conjuro')) {
        controller.graveyard.push(card);
        controller.graveyardCount = controller.graveyard.length;
      } else {
        card.enteredFieldTurn = state.turnCount;
        controller.field.push(card);
      }
    }
    
    // Apply specific effect logic
    if (item.targetId) {
       this.executeTargetEffectLogic(item, state);
    } else if (item.effect) {
       const effect = item.effect;
       if (effect.needsTarget && !item.targetId) {
         // This was an ETB that needs a target but hasn't been chosen yet
         state.pendingTarget = {
           sourceCardId: item.sourceCardId,
           validTargets: effect.validTargets,
           effect: effect.effect,
           value: effect.value
         };
         this.notificationService.showToast('Efecto de entrada', 'Selecciona un objetivo para la habilidad.', 'INFO');
       } else {
         this.executeNonTargetEffect(effect, controller);
       }
    }
  }



  private processAutomaticPhaseActions(state: GameState, phase: GamePhase): GameState {
    let newState = { ...state };
    if (phase === GamePhase.UNTAP) {
      newState = this.untapEverything(newState, newState.activePlayerId);
      newState = this.resetCombatStatus(newState);
    } else if (phase === GamePhase.DRAW) {
      newState = this.drawCard(newState, newState.activePlayerId);
    } else if (phase === GamePhase.END) {
      newState = this.resetCombatStatus(newState);
    }
    return newState;
  }

  private resetCombatStatus(state: GameState): GameState {
    const reset = (p: PlayerGameState) => {
      p.field = p.field.map(c => ({ ...c, isAttacking: false, isBlocking: false }));
    };
    reset(state.player1);
    reset(state.player2);
    return state;
  }

  private untapEverything(state: GameState, playerId: string): GameState {
    const isP1 = state.player1.id === playerId;
    
    // The active player's cards untap, but BOTH players' cards heal (cleanup step happens right before this, but doing it here works)
    const updatedPlayer1 = {
      ...state.player1,
      field: state.player1.field.map(c => ({
        ...c,
        isTapped: isP1 ? false : c.isTapped,
        damageTaken: 0
      }))
    };
    
    const updatedPlayer2 = {
      ...state.player2,
      field: state.player2.field.map(c => ({
        ...c,
        isTapped: !isP1 ? false : c.isTapped,
        damageTaken: 0
      }))
    };

    return {
      ...state,
      player1: updatedPlayer1,
      player2: updatedPlayer2
    };
  }

  private drawCard(state: GameState, playerId: string): GameState {
    const isP1 = state.player1.id === playerId;
    const p = isP1 ? state.player1 : state.player2;

    if (p.library.length > 0) {
      const library = [...p.library];
      const hand = [...p.hand];
      const card = library.shift()!;
      hand.push(card);
      
      const updatedPlayer = {
        ...p,
        library: library,
        hand: hand,
        libraryCount: library.length,
        handCount: hand.length
      };
      
      return {
        ...state,
        [isP1 ? 'player1' : 'player2']: updatedPlayer
      };
    }
    return state;
  }

  private rotateTurn(): void {
    const state = this.gameStateSubject.value;
    if (!state) return;

    let newState = { ...state };
    const nextPlayerId = state.activePlayerId === state.player1.id ? state.player2.id : state.player1.id;
    newState.activePlayerId = nextPlayerId;
    newState.currentPhase = GamePhase.UNTAP;
    newState.landsPlayedThisTurn = 0;
    newState.turnCount = state.activePlayerId === state.player2.id ? state.turnCount + 1 : state.turnCount;
    
    newState.player1 = { ...newState.player1, manaPool: this.createEmptyManaPool() };
    newState.player2 = { ...newState.player2, manaPool: this.createEmptyManaPool() };
    
    // Priority resets to the player whose turn it is
    newState.priorityPlayerId = nextPlayerId;
    newState.passedCount = 0;

    // Untap everything for the new player
    newState = this.untapEverything(newState, nextPlayerId);

    this.gameStateSubject.next(newState);
    this.battleService.pushState(newState.matchId, newState).subscribe({
      next: () => { this.isProcessing = false; },
      error: () => { this.isProcessing = false; }
    });
  }

  playCard(cardId: string): void {
    const state = this.gameStateSubject.value;
    if (!state || this.isProcessing || state.pendingManaChoice || state.pendingPayment) return;
    this.isProcessing = true;

    const p = this.me();
    if (!p) {
      this.isProcessing = false;
      return;
    }

    const cardIndex = p.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) {
      this.isProcessing = false;
      return;
    }
    const card = p.hand[cardIndex];
    const isFast = this.isFastCard(card);
    
    const myId = this.userService.getCurrentUser()?.id?.toString();
    if (state?.activePlayerId !== myId && !isFast) {
      this.notificationService.showToast('Acción inválida', 'Solo puedes jugar Instantáneos o cartas con Destello fuera de tu turno.', 'WARNING');
      this.isProcessing = false;
      return;
    }

    const isMainPhase = state.currentPhase === GamePhase.MAIN_1 || state.currentPhase === GamePhase.MAIN_2;
    if (!isMainPhase && !isFast) {
      this.notificationService.showToast('Fase incorrecta', 'Solo puedes jugar esta carta en tus fases principales.', 'WARNING');
      this.isProcessing = false;
      return;
    }
    const isLand = card.type?.toLowerCase().includes('land') || card.type?.toLowerCase().includes('tierra');

      if (isLand) {
        if (state.landsPlayedThisTurn >= 1) {
          this.notificationService.showToast('Acción bloqueada', 'Ya has bajado una tierra este turno.', 'WARNING');
          this.isProcessing = false;
          return;
        }
        
        // Play land immediately
        p.hand.splice(cardIndex, 1);
        p.field.push(card);
        p.handCount = p.hand.length;
        this.updateState({ landsPlayedThisTurn: state.landsPlayedThisTurn + 1 }, true, () => {
          this.isProcessing = false;
        });
      } else {
        // Validation for non-land cards (Mana Cost)
        const costReq = this.parseManaCost(card.manaCost || []);
        if (!this.canAffordParsed(costReq, p.manaPool)) {
          this.notificationService.showToast('Falta maná', `No tienes suficiente maná para jugar "${card.name}".`, 'WARNING');
          this.isProcessing = false;
          return;
        }

        // Subtract specific costs first
        this.paySpecificCosts(costReq, p.manaPool);

        const totalAvailable = Object.values(p.manaPool).reduce((a, b) => a + b, 0);
        
        if (costReq.generic === 0) {
          // No generic cost, proceed
          this.finishPlayingCard(cardId);
        } else if (totalAvailable === costReq.generic) {
          // Exactly enough mana, auto-pay all and proceed
          this.autoPayGenericInternal(p.manaPool, costReq.generic);
          this.finishPlayingCard(cardId);
        } else {
          // Ambiguity! Show payment UI
          state.pendingPayment = {
            cardId: cardId,
            remainingGeneric: costReq.generic,
            specificPaid: true
          };
          this.gameStateSubject.next({ ...state });
          // Keep isProcessing = true to block polling while payment UI is open
        }
    }
  }

  private finishPlayingCard(cardId: string): void {
    const state = this.gameStateSubject.value;
    const p = this.me();
    if (!state || !p) return;

    const cardIndex = p.hand.findIndex(c => c.id === cardId);
    if (cardIndex !== -1) {
      const card = p.hand[cardIndex];
      const effect = this.parseCardEffect(card);

      const isSpell = this.isSpell(card);

      // Handle targeting if needed (Only for Spells at casting time)
      if (isSpell && effect && effect.needsTarget && !state.pendingTarget) {
        state.pendingTarget = {
          sourceCardId: card.id,
          validTargets: effect.validTargets,
          effect: effect.effect,
          value: effect.value
        };
        this.notificationService.showToast('Selecciona objetivo', `Elige un objetivo para ${card.name}`, 'INFO');
        this.gameStateSubject.next({ ...state });
        this.isProcessing = false;
        return;
      }

      // Create Stack Item
      const stackItem: StackItem = {
        id: Math.random().toString(36).substr(2, 9),
        sourceCardId: card.id,
        controllerId: p.id,
        type: 'SPELL',
        name: card.name,
        card: { ...card },
        imageUrl: card.imageUrl,
        effect: effect,
        targetId: state.pendingTarget?.sourceCardId === card.id ? this.selectedTargetId : undefined,
        targetType: state.pendingTarget?.sourceCardId === card.id ? this.selectedTargetType : undefined
      };

      // Remove from hand immediately
      p.hand.splice(cardIndex, 1);
      p.handCount = p.hand.length;

      // Resolve immediately (Sandbox Mode)
      // this.applyResolvedEffect(stackItem, state);
      
      // Add to stack
      const newStack = [...state.stack, stackItem];
      
      // Cleanup pending states
      state.pendingPayment = undefined;
      state.pendingTarget = undefined;
      
      // After playing something, priority remains with the player who played it
      // but everyone else must pass again to resolve it.
      this.updateState({ 
        stack: newStack,
        passedCount: 0 
      }, true, () => {
        this.isProcessing = false;
      });
    }
  }

  private selectedTargetId?: string;
  private selectedTargetType?: 'CREATURE' | 'PLAYER';

  private executeTargetEffectLogic(item: StackItem, state: GameState): void {
    const targetType = item.targetType;
    const targetId = item.targetId;
    const effect = item.effect?.effect;
    const value = item.effect?.value || 0;

    if (!targetId || !targetType) return;

    if (targetType === 'PLAYER') {
      const targetPlayer = state.player1.id === targetId ? state.player1 : state.player2;
      if (effect === 'DAMAGE') {
        targetPlayer.hp -= value;
      }
    } else {
      const p1Card = state.player1.field.find(c => c.id === targetId);
      const p2Card = state.player2.field.find(c => c.id === targetId);
      const targetCard = p1Card || p2Card;
      const ownerId = p1Card ? state.player1.id : state.player2.id;

      if (targetCard) {
        if (effect === 'DAMAGE') {
          const t = parseInt(targetCard.toughness || '0');
          if (t - value <= 0) {
            this.moveToGraveyard(targetCard.id, ownerId);
          } else {
            targetCard.toughness = (t - value).toString();
          }
        } else if (effect === 'DESTROY') {
          this.moveToGraveyard(targetCard.id, ownerId);
        } else if (effect === 'BOUNCE') {
          this.returnToHand(targetCard.id, ownerId);
        }
      }
    }
  }

  private parseCardEffect(card: GameCard): any {
    const text = (card.oracleText || '').toLowerCase();
    
    // 1. Draw cards: "Draw X cards"
    const drawMatch = text.match(/draw (\d+) card/);
    if (drawMatch) {
      return { effect: 'DRAW', value: parseInt(drawMatch[1]), needsTarget: false };
    }

    // 2. Damage effects
    const damageMatch = text.match(/deal (\d+) damage/);
    if (damageMatch) {
      const val = parseInt(damageMatch[1]);
      let targets: any = 'ANY';
      if (text.includes('target creature or player')) targets = 'ANY';
      else if (text.includes('target creature')) targets = 'CREATURE';
      else if (text.includes('target player')) targets = 'PLAYER';
      
      return { effect: 'DAMAGE', value: val, validTargets: targets, needsTarget: true };
    }

    // 3. Destruction effects
    if (text.includes('destroy target creature')) {
      return { effect: 'DESTROY', validTargets: 'CREATURE', needsTarget: true };
    }

    // 4. Bounce effects: "Return target creature to its owner's hand"
    if (text.includes('return target creature to its owner\'s hand') || text.includes('devuelve la criatura objetivo a la mano')) {
      return { effect: 'BOUNCE', validTargets: 'CREATURE', needsTarget: true };
    }

    return null;
  }

  private executeNonTargetEffect(effect: any, player: PlayerGameState): void {
    if (effect.effect === 'DRAW') {
      for (let i = 0; i < effect.value; i++) {
        this.drawCardToPlayer(player);
      }
      this.notificationService.showToast('Robo', `Has robado ${effect.value} cartas.`, 'SUCCESS');
    }
  }

  private drawCardToPlayer(p: PlayerGameState): void {
    if (p.library.length > 0) {
      const card = p.library.shift()!;
      p.hand.push(card);
      p.handCount = p.hand.length;
      p.libraryCount = p.library.length;
    }
  }

  private isFastCard(card: GameCard): boolean {
    const type = (card.type || '').toLowerCase();
    const isInstant = type.includes('instant') || type.includes('instantáneo');
    const hasFlash = this.hasAbility(card, 'flash') || this.hasAbility(card, 'destello');
    return isInstant || hasFlash;
  }

  private isSpell(card: GameCard): boolean {
    const type = (card.type || '').toLowerCase();
    return type.includes('instant') || type.includes('sorcery') || 
           type.includes('instantáneo') || type.includes('conjuro') ||
           type.includes('creature') || type.includes('criatura') ||
           type.includes('artifact') || type.includes('artefacto') ||
           type.includes('enchantment') || type.includes('encantamiento') ||
           type.includes('planeswalker');
  }

  private parseManaCost(cost: string[]): any {
    const req: any = { white: 0, blue: 0, black: 0, red: 0, green: 0, colorless: 0, generic: 0 };
    cost.forEach(s => {
      const v = s.toUpperCase().replace(/{|}/g, '');
      if (v === 'W') req.white++;
      else if (v === 'U') req.blue++;
      else if (v === 'B') req.black++;
      else if (v === 'R') req.red++;
      else if (v === 'G') req.green++;
      else if (v === 'C') req.colorless++;
      else if (!isNaN(parseInt(v))) req.generic += parseInt(v);
    });
    return req;
  }

  private canAffordParsed(req: any, pool: ManaPool): boolean {
    if (pool.white < req.white) return false;
    if (pool.blue < req.blue) return false;
    if (pool.black < req.black) return false;
    if (pool.red < req.red) return false;
    if (pool.green < req.green) return false;
    if (pool.colorless < req.colorless) return false;

    const totalAvailableAfterSpecific = 
      (pool.white - req.white) + (pool.blue - req.blue) + 
      (pool.black - req.black) + (pool.red - req.red) + 
      (pool.green - req.green) + (pool.colorless - req.colorless);
    
    return totalAvailableAfterSpecific >= req.generic;
  }

  private paySpecificCosts(req: any, pool: ManaPool): void {
    pool.white -= req.white;
    pool.blue -= req.blue;
    pool.black -= req.black;
    pool.red -= req.red;
    pool.green -= req.green;
    pool.colorless -= req.colorless;
  }

  payGenericMana(color: string): void {
    const state = this.gameStateSubject.value;
    if (!state?.pendingPayment) return;

    const p = this.me();
    if (!p) return;
    
    const poolKey = color as keyof ManaPool;
    if (p.manaPool[poolKey] <= 0) return;

    p.manaPool[poolKey]--;
    state.pendingPayment.remainingGeneric--;

    if (state.pendingPayment.remainingGeneric <= 0) {
      this.isProcessing = true;
      this.finishPlayingCard(state.pendingPayment.cardId);
    } else {
      this.gameStateSubject.next({ ...state });
    }
  }

  autoPayGeneric(): void {
    const state = this.gameStateSubject.value;
    if (!state?.pendingPayment) return;
    
    const p = this.me();
    if (!p) return;

    this.autoPayGenericInternal(p.manaPool, state.pendingPayment.remainingGeneric);
    this.isProcessing = true;
    this.finishPlayingCard(state.pendingPayment.cardId);
  }

  private autoPayGenericInternal(pool: ManaPool, amount: number): void {
    let remaining = amount;
    // Priority 1: Colorless
    const colorlessSpend = Math.min(pool.colorless, remaining);
    pool.colorless -= colorlessSpend;
    remaining -= colorlessSpend;

    if (remaining <= 0) return;

    // Priority 2: Colors (equally distributed to keep a balanced pool if possible)
    const colors: (keyof ManaPool)[] = ['white', 'blue', 'black', 'red', 'green'];
    while (remaining > 0) {
      // Find color with most mana to spend first
      let bestColor: keyof ManaPool | null = null;
      let maxVal = 0;
      for (const c of colors) {
        if (pool[c] > maxVal) {
          maxVal = pool[c];
          bestColor = c;
        }
      }
      if (!bestColor) break; // Should not happen if canAfford was true
      pool[bestColor]--;
      remaining--;
    }
  }

  cancelPayment(): void {
    const state = this.gameStateSubject.value;
    if (!state?.pendingPayment) return;
    
    // We need to refund the mana and restore state
    // But since we just want to cancel, the easiest is to just refresh state from server 
    // or manually undo. For now, let's just clear the pending state and NOT update server.
    // However, mana was already subtracted locally. 
    // Best practice: Reload state from server.
    this.isProcessing = false;
    this.refreshGameState();
  }

  private spendMana(cost: string[], pool: ManaPool): void {
    const req: any = { white: 0, blue: 0, black: 0, red: 0, green: 0, generic: 0 };
    cost.forEach(s => {
      const v = s.toUpperCase().replace(/{|}/g, '');
      if (v === 'W') req.white++;
      else if (v === 'U') req.blue++;
      else if (v === 'B') req.black++;
      else if (v === 'R') req.red++;
      else if (v === 'G') req.green++;
      else if (!isNaN(parseInt(v))) req.generic += parseInt(v);
    });

    pool.white -= req.white;
    pool.blue -= req.blue;
    pool.black -= req.black;
    pool.red -= req.red;
    pool.green -= req.green;

    let remainingGeneric = req.generic;
    // Consume colorless first for generic
    const consume = (type: keyof ManaPool, amt: number) => {
      const take = Math.min((pool as any)[type], amt);
      (pool as any)[type] -= take;
      return amt - take;
    };

    remainingGeneric = consume('colorless', remainingGeneric);
    if (remainingGeneric > 0) remainingGeneric = consume('white', remainingGeneric);
    if (remainingGeneric > 0) remainingGeneric = consume('blue', remainingGeneric);
    if (remainingGeneric > 0) remainingGeneric = consume('black', remainingGeneric);
    if (remainingGeneric > 0) remainingGeneric = consume('red', remainingGeneric);
    if (remainingGeneric > 0) remainingGeneric = consume('green', remainingGeneric);
  }

  discardCard(cardId: string): void {
    const state = this.gameStateSubject.value;
    if (!state || state.currentPhase !== GamePhase.END) return;

    const p = this.me();
    if (!p) return;

    const cardIndex = p.hand.findIndex(c => c.id === cardId);
    if (cardIndex !== -1) {
      const card = p.hand.splice(cardIndex, 1)[0];
      p.graveyard.push(card);
      p.handCount = p.hand.length;
      p.graveyardCount = p.graveyard.length;
      this.updateState({});
    }
  }

  tapCard(cardId: string): void {
    const state = this.gameStateSubject.value;
    if (!state || this.isProcessing || state.pendingManaChoice || state.pendingPayment) return;
    
    // Handle Target Selection first
    if (state.pendingTarget) {
      this.handleTargetSelection(cardId);
      return;
    }

    if (state.currentPhase === GamePhase.UNTAP) {
      this.notificationService.showToast('Fase UNTAP', 'No se puede actuar durante el paso de enderezar.', 'INFO');
      return;
    }
    
    const myId = this.userService.getCurrentUser()?.id?.toString();
    const isMyTurn = state.activePlayerId === myId;
    
    const p = this.me();
    const opp = this.opponent();
    if (!p || !opp) return;

    const myCard = p.field.find(c => c.id === cardId);

    // 1. IF IT'S MY TURN
    if (isMyTurn) {
      if (!myCard) return;
      if (state.currentPhase === GamePhase.COMBAT) {
        this.attackWithCard(myCard);
      } else {
        this.produceManaFromCard(myCard);
      }
    } 
    // 2. IF IT'S NOT MY TURN
    else {
      // If clicking my own card:
      if (myCard) {
        const isLand = myCard.type?.toLowerCase().includes('land') || myCard.type?.toLowerCase().includes('tierra');
        
        // In Combat: Creatures block, Lands still produce mana
        if (state.currentPhase === GamePhase.COMBAT && !isLand) {
          this.handleBlockingAction(cardId, p, opp);
        } else {
          // Anytime else (or if it's a land): produce mana
          this.produceManaFromCard(myCard);
        }
      }
      // If clicking opponent's card (only relevant during blocking assignment)
      else if (state.currentPhase === GamePhase.COMBAT) {
        this.handleBlockingAction(cardId, p, opp);
      }
    }
  }

  private handleTargetSelection(targetId: string): void {
    const state = this.gameStateSubject.value;
    if (!state || !state.pendingTarget) return;

    const isP1 = state.player1.id === targetId;
    const isP2 = state.player2.id === targetId;
    const targetType = (isP1 || isP2) ? 'PLAYER' : 'CREATURE';
    
    // Validation
    const req = state.pendingTarget.validTargets;
    if (req === 'CREATURE' && targetType !== 'CREATURE') {
      this.notificationService.showToast('Objetivo inválido', 'Debes elegir una criatura.', 'WARNING');
      return;
    }
    if (req === 'PLAYER' && targetType !== 'PLAYER') {
      this.notificationService.showToast('Objetivo inválido', 'Debes elegir un jugador.', 'WARNING');
      return;
    }

    this.executeTargetEffect(targetId, targetType);
  }

  private executeTargetEffect(targetId: string, targetType: 'CREATURE' | 'PLAYER'): void {
    const state = this.gameStateSubject.value;
    if (!state || !state.pendingTarget) return;

    this.selectedTargetId = targetId;
    this.selectedTargetType = targetType;

    // Now finish playing the source card (it will be pushed to stack with these targets)
    const sourceCardId = state.pendingTarget.sourceCardId;
    state.pendingTarget = undefined; 
    this.finishPlayingCard(sourceCardId);
  }

  targetPlayer(playerId: string): void {
    const state = this.gameStateSubject.value;
    if (state?.pendingTarget) {
      this.handleTargetSelection(playerId);
    }
  }


  private attackWithCard(card: GameCard): void {
    const state = this.gameStateSubject.value;
    if (!state) return;

    const isCreature = (card.type || '').toLowerCase().includes('creature') || (card.type || '').toLowerCase().includes('criatura');
    if (!isCreature) {
      this.notificationService.showToast('Acción inválida', 'Solo las criaturas pueden atacar.', 'INFO');
      return;
    }

    if (card.isTapped && !card.isAttacking) {
      this.notificationService.showToast('Acción inválida', 'Una criatura girada no puede atacar.', 'INFO');
      return;
    }

    // Summoning Sickness check
    const hasHaste = this.hasAbility(card, 'haste') || this.hasAbility(card, 'prisa');
    if (card.enteredFieldTurn === state.turnCount && !hasHaste) {
      this.notificationService.showToast('Mareo de invocación', 'Esta criatura acaba de llegar, no puede atacar todavía.', 'WARNING');
      return;
    }

    this.isProcessing = true;
    if (card.isAttacking) {
      // Un-declare attacker
      card.isAttacking = false;
      const hasVigilance = this.hasAbility(card, 'vigilance') || this.hasAbility(card, 'vigilancia');
      if (!hasVigilance) card.isTapped = false;
    } else {
      // Declare attacker
      card.isAttacking = true;
      const hasVigilance = this.hasAbility(card, 'vigilance') || this.hasAbility(card, 'vigilancia');
      if (!hasVigilance) card.isTapped = true;
    }

    this.updateState({}, true, () => {
      this.isProcessing = false;
    });
  }

  private handleBlockingAction(cardId: string, me: PlayerGameState, opp: PlayerGameState): void {
    this.isProcessing = true;
    // 1. Check if clicking my own card to select it as a blocker
    const myCard = me.field.find(c => c.id === cardId);
    if (myCard) {
      if (myCard.isTapped) {
        this.notificationService.showToast('Acción inválida', 'Una criatura girada no puede bloquear.', 'INFO');
        return;
      }
      // Toggle selection for blocking
      if (myCard.isBlocking) {
        myCard.isBlocking = false;
      } else {
        // Select this card as the current "active" blocker
        // We DON'T clear others anymore, just toggle this one
        myCard.isBlocking = true;
        this.notificationService.showToast('Bloqueador', `Selecciona qué atacante bloquea ${myCard.name}`, 'INFO');
      }
      this.updateState({}, true, () => {
        this.isProcessing = false;
      });
      return;
    }

    // 2. Check if clicking an opponent's attacker to assign the selected blocker
    const selectedBlocker = me.field.find(c => c.isBlocking);
    const opponentAttacker = opp.field.find(c => c.id === cardId && c.isAttacking);

    if (selectedBlocker && opponentAttacker) {
      // VALIDATION: UNBLOCKABLE
      const isUnblockable = this.hasAbility(opponentAttacker, 'unblockable') || this.hasAbility(opponentAttacker, 'imbloqueable');
      if (isUnblockable) {
        this.notificationService.showToast('No puede bloquear', `${opponentAttacker.name} es imbloqueable.`, 'WARNING');
        this.isProcessing = false;
        return;
      }

      // VALIDATION: FLYING / REACH
      const attackerHasFlying = this.hasAbility(opponentAttacker, 'flying') || this.hasAbility(opponentAttacker, 'vuela');
      const blockerHasFlying = this.hasAbility(selectedBlocker, 'flying') || this.hasAbility(selectedBlocker, 'vuela');
      const blockerHasReach = this.hasAbility(selectedBlocker, 'reach') || this.hasAbility(selectedBlocker, 'alcance');

      if (attackerHasFlying && !blockerHasFlying && !blockerHasReach) {
        this.notificationService.showToast('No puede bloquear', `${opponentAttacker.name} vuela y no tienes Alcance.`, 'WARNING');
        this.isProcessing = false;
        return;
      }

      selectedBlocker.blockingTargetId = opponentAttacker.id;
      selectedBlocker.isBlocking = false; // Finished assigning this one
      this.notificationService.showToast('Bloqueo asignado', `${selectedBlocker.name} bloquea a ${opponentAttacker.name}`, 'SUCCESS');
      
      // Hint for Menace
      const hasMenace = this.hasAbility(opponentAttacker, 'menace') || this.hasAbility(opponentAttacker, 'menaza');
      if (hasMenace) {
        const currentBlockers = me.field.filter(c => c.blockingTargetId === opponentAttacker.id).length;
        if (currentBlockers < 2) {
          this.notificationService.showToast('Menaza', `${opponentAttacker.name} tiene Menaza. Necesitas al menos otro bloqueador.`, 'INFO');
        }
      }

      this.updateState({}, true, () => {
        this.isProcessing = false;
      });
    } else {
      this.isProcessing = false;
    }
  }

  hasAbility(card: GameCard, ability: string): boolean {
    const text = (card.oracleText || '').toLowerCase();
    const type = (card.type || '').toLowerCase();
    const name = (card.name || '').toLowerCase();
    
    const a = ability.toLowerCase();
    if (a === 'haste' || a === 'prisa') return text.includes('haste') || text.includes('prisa');
    if (a === 'vigilance' || a === 'vigilancia') return text.includes('vigilance') || text.includes('vigilancia');
    if (a === 'lifelink' || a === 'vínculo vital') return text.includes('lifelink') || text.includes('vínculo vital');
    if (a === 'deathtouch' || a === 'toque mortal') return text.includes('deathtouch') || text.includes('toque mortal');
    if (a === 'trample' || a === 'arrollar') return text.includes('trample') || text.includes('arrollar');
    if (a === 'indestructible') return text.includes('indestructible');
    if (a === 'flying' || a === 'vuela') return text.includes('flying') || text.includes('vuela') || type.includes('flying') || type.includes('vuela');
    if (a === 'reach' || a === 'alcance') return text.includes('reach') || text.includes('alcance');
    if (a === 'first strike' || a === 'dañar primero') return text.includes('first strike') || text.includes('dañar primero');
    if (a === 'double strike' || a === 'dañar dos veces') return text.includes('double strike') || text.includes('dañar dos veces');
    if (a === 'unblockable' || a === 'imbloqueable') return text.includes('unblockable') || text.includes('imbloqueable') || text.includes('no puede ser bloqueada');
    if (a === 'menace' || a === 'menaza') return text.includes('menace') || text.includes('menaza');
    if (a === 'ward' || a === 'protección') return text.includes('ward') || text.includes('protección');
    
    return false;
  }

  private produceManaFromCard(card: GameCard): void {
    const state = this.gameStateSubject.value;
    if (!state) return;
    const p = this.me();
    if (!p) return;

    if (card.isTapped) {
      this.notificationService.showToast('Acción inválida', 'La carta ya está girada.', 'INFO');
      return;
    }

    // Summoning Sickness check for non-lands
    const isLand = card.type?.toLowerCase().includes('land') || card.type?.toLowerCase().includes('tierra');
    const hasHaste = this.hasAbility(card, 'haste') || this.hasAbility(card, 'prisa');
    if (!isLand && card.enteredFieldTurn === state.turnCount && !hasHaste) {
      this.notificationService.showToast('Mareo de invocación', 'Esta criatura no puede activar habilidades todavía.', 'WARNING');
      return;
    }

    this.isProcessing = true;
    card.isTapped = true;
    
    const produced = card.producedMana || [];
    if (produced.length > 1) {
      state.pendingManaChoice = {
        playerId: p.id,
        cardId: card.id,
        options: produced
      };
      this.gameStateSubject.next({ ...state });
      this.updateState({}, true); // Keep isProcessing = true
    } else {
      const manaType = produced.length === 1 ? this.mapColorToPoolKey(produced[0]) : this.getManaType(card);
      if (manaType) {
        (p.manaPool as any)[manaType]++;
      }
      this.updateState({}, true, () => {
        this.isProcessing = false;
      });
    }
  }

  resolveManaChoice(color: string): void {
    const state = this.gameStateSubject.value;
    if (!state || !state.pendingManaChoice) return;

    const p = this.me();
    if (!p) return;

    const manaType = this.mapColorToPoolKey(color);
    if (manaType) {
      (p.manaPool as any)[manaType]++;
      console.log(`Choice resolved: ${manaType}. New pool:`, { ...p.manaPool });
    }

    state.pendingManaChoice = undefined;
    // Local update to hide overlay
    this.gameStateSubject.next({ ...state });
    this.updateState({}, true, () => {
      this.isProcessing = false;
    });
  }

  private mapColorToPoolKey(color: string): keyof ManaPool | null {
    const c = color.toUpperCase();
    if (c === 'W') return 'white';
    if (c === 'U') return 'blue';
    if (c === 'B') return 'black';
    if (c === 'R') return 'red';
    if (c === 'G') return 'green';
    if (c === 'C') return 'colorless';
    return null;
  }

  private createEmptyManaPool(): any {
    return { white: 0, blue: 0, black: 0, red: 0, green: 0, colorless: 0 };
  }

  private clearManaPools(): void {
    const state = this.gameStateSubject.value;
    if (!state) return;
    state.player1.manaPool = this.createEmptyManaPool();
    state.player2.manaPool = this.createEmptyManaPool();
    this.updateState({});
  }

  private getManaType(card: GameCard): keyof ManaPool | null {
    const typeLine = (card.type || '').toLowerCase();
    const name = (card.name || '').toLowerCase();
    
    if (typeLine.includes('forest') || name.includes('bosque')) return 'green';
    if (typeLine.includes('island') || name.includes('isla')) return 'blue';
    if (typeLine.includes('mountain') || name.includes('montaña')) return 'red';
    if (typeLine.includes('swamp') || name.includes('pantano')) return 'black';
    if (typeLine.includes('plains') || name.includes('llanura')) return 'white';
    
    if (typeLine.includes('land') || typeLine.includes('tierra')) return 'colorless';
    return null;
  }

  public updateState(patch: Partial<GameState>, sync: boolean = true, onComplete?: () => void): void {
    const current = this.gameStateSubject.value;
    if (current) {
      let newState = { ...current, ...patch };
      
      // Check for Game Over before syncing
      newState = this.checkGameOver(newState);

      this.gameStateSubject.next(newState);
      if (sync) {
        this.battleService.pushState(newState.matchId, newState).subscribe({
          next: () => { 
            console.log("✅ Sync OK");
            if (onComplete) onComplete(); 
          },
          error: (err) => { 
            console.error("❌ Sync Error:", err);
            if (err.status === 401) {
              this.notificationService.showToast('Sesión Expirada', 'Tu sesión no es válida. Por favor, haz login de nuevo.', 'ERROR');
            }
            if (onComplete) onComplete(); 
          }
        });
      } else if (onComplete) {
        onComplete();
      }
    } else if (onComplete) {
      onComplete();
    }
  }

  private checkGameOver(state: GameState): GameState {
    if (state.winnerId) return state; // Already over

    if (state.player1.hp <= 0 && state.player2.hp <= 0) {
      // Rare draw, but let's say P2 wins if both die? Or just handle it.
      state.winnerId = 'DRAW'; 
      this.notificationService.showToast('¡Empate!', 'Ambos jugadores han caído.', 'INFO');
    } else if (state.player1.hp <= 0) {
      state.winnerId = state.player2.id;
      this.notificationService.showToast('¡Partida terminada!', `Ganador: ${state.player2.username}`, 'SUCCESS');
    } else if (state.player2.hp <= 0) {
      state.winnerId = state.player1.id;
      this.notificationService.showToast('¡Partida terminada!', `Ganador: ${state.player1.username}`, 'SUCCESS');
    }
    return state;
  }

  refreshGameState(): void {
    const state = this.gameStateSubject.value;
    if (state) {
      this.pollState(state.matchId);
    }
  }

  resetLives(): void {
    const state = this.gameStateSubject.value;
    if (!state) return;
    state.player1.hp = 20;
    state.player2.hp = 20;
    this.updateState({ player1: state.player1, player2: state.player2 }, true);
    this.notificationService.showToast('Debug', 'Vidas reseteadas a 20.', 'INFO');
  }

  private shuffle(array: any[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private resolveCombat(): boolean {
    const state = this.gameStateSubject.value;
    if (!state) return false;

    const activePlayer = state.player1.id === state.activePlayerId ? state.player1 : state.player2;
    const defendingPlayer = state.player1.id === state.activePlayerId ? state.player2 : state.player1;

    const attackers = activePlayer.field.filter(c => c.isAttacking);
    console.log(`⚔️ Resolviendo combate: ${attackers.length} atacantes encontrados.`);
    if (attackers.length === 0) return false;

    // 1. Validate Menace and other illegal blocks
    attackers.forEach(attacker => {
      const blockers = defendingPlayer.field.filter(c => c.blockingTargetId === attacker.id);
      const hasMenace = this.hasAbility(attacker, 'menace') || this.hasAbility(attacker, 'menaza');
      if (hasMenace && blockers.length === 1) {
         blockers.forEach(b => {
           b.blockingTargetId = undefined;
           b.isBlocking = false;
         });
         this.notificationService.showToast('Bloqueo ilegal', `Menaza: ${attacker.name} no puede ser bloqueado por una sola criatura.`, 'WARNING');
      }
    });

    // 1.5 Check for un-ordered multi-blocking
    const unOrderedMultiBlockers = attackers.filter(attacker => {
      const blockers = defendingPlayer.field.filter(c => c.blockingTargetId === attacker.id);
      return blockers.length > 1 && !(attacker as any).orderedBlockers;
    });

    if (unOrderedMultiBlockers.length > 0 || (state.pendingBlockerOrders && state.pendingBlockerOrders.length > 0)) {
      if (unOrderedMultiBlockers.length > 0 && !state.pendingBlockerOrders?.length) {
         const pendingOrders = unOrderedMultiBlockers.map(a => ({
           attackerId: a.id,
           blockerIds: defendingPlayer.field.filter(c => c.blockingTargetId === a.id).map(c => c.id)
         }));
         console.log(`⏸️ Pausando combate para elegir orden de bloqueadores...`);
         this.updateState({ pendingBlockerOrders: pendingOrders }, true);
      }
      this.isProcessing = false; 
      return true; 
    }

    // 2. FIRST STRIKE / DOUBLE STRIKE STEP
    attackers.forEach(attacker => {
      const blockers = defendingPlayer.field.filter(c => c.blockingTargetId === attacker.id);
      console.log(`🔎 Atacante ${attacker.name} bloqueado por: ${blockers.length} criaturas (ID: ${attacker.id}).`);
      
      const hasFS = this.hasAbility(attacker, 'first strike') || this.hasAbility(attacker, 'dañar primero');
      const hasDS = this.hasAbility(attacker, 'double strike') || this.hasAbility(attacker, 'dañar dos veces');
      
      if (blockers.length > 0) {
        const blocker = blockers[0];
        const blockerFS = this.hasAbility(blocker, 'first strike') || this.hasAbility(blocker, 'dañar primero');
        const blockerDS = this.hasAbility(blocker, 'double strike') || this.hasAbility(blocker, 'dañar dos veces');

        if ((hasFS || hasDS) && !(blockerFS || blockerDS)) {
          this.fight(attacker, blocker, activePlayer, defendingPlayer, true); 
        } else if (!(hasFS || hasDS) && (blockerFS || blockerDS)) {
          this.fight(attacker, blocker, activePlayer, defendingPlayer, false, true);
        } else if ((hasFS || hasDS) && (blockerFS || blockerDS)) {
          this.fight(attacker, blocker, activePlayer, defendingPlayer);
        }
      }
    });

    // 3. NORMAL DAMAGE STEP
    attackers.forEach(attacker => {
      const attackerStillAlive = activePlayer.field.find(c => c.id === attacker.id);
      if (!attackerStillAlive) return;

      const blockers = defendingPlayer.field.filter(c => c.blockingTargetId === attacker.id);
      if (blockers.length === 0) {
        console.log(`💥 ${attacker.name} NO bloqueado. Daño directo: ${this.getModifiedPower(attacker, activePlayer)}`);
        defendingPlayer.hp -= this.getModifiedPower(attacker, activePlayer);
      } else {
        console.log(`🛡️ ${attacker.name} bloqueado. Resolviendo combate con bloqueadores.`);
        
        let hasTrample = this.hasAbility(attacker, 'trample') || this.hasAbility(attacker, 'arrollar');
        this.fightSequential(attacker, blockers, activePlayer, defendingPlayer);

        if (hasTrample) {
           // Simplistic trample logic post-combat
        }
      }
    });

    // Cleanup
    attackers.forEach(c => {
      c.isAttacking = false;
      c.orderedBlockers = undefined;
    });
    defendingPlayer.field.forEach(c => {
      c.blockingTargetId = undefined;
      c.isBlocking = false;
    });

    console.log("🔥 Combate resuelto. Sincronizando daños...");
    
    this.updateState({ 
      player1: { ...state.player1 }, 
      player2: { ...state.player2 },
      pendingBlockerOrders: []
    }, true);
    return false;
  }

  private fight(attacker: GameCard, blocker: GameCard, activePlayer: PlayerGameState, defendingPlayer: PlayerGameState, attackerOnly = false, blockerOnly = false): void {
    const ap = this.getModifiedPower(attacker, activePlayer);
    const at = this.getModifiedToughness(attacker, activePlayer);
    const bp = this.getModifiedPower(blocker, defendingPlayer);
    const bt = this.getModifiedToughness(blocker, defendingPlayer);

    const attackerIndestructible = this.hasAbility(attacker, 'indestructible');
    const blockerIndestructible = this.hasAbility(blocker, 'indestructible');
    const hasDeathtouch = this.hasAbility(attacker, 'deathtouch') || this.hasAbility(attacker, 'toque mortal');
    const blockerDeathtouch = this.hasAbility(blocker, 'deathtouch') || this.hasAbility(blocker, 'toque mortal');

    if (!blockerOnly && ap > 0) {
      if (this.hasAbility(attacker, 'lifelink') || this.hasAbility(attacker, 'vínculo vital')) {
        activePlayer.hp += ap;
      }
      
      if (hasDeathtouch) {
        if (!blockerIndestructible) this.moveToGraveyard(blocker.id, defendingPlayer.id);
      } else {
        blocker.damageTaken = (blocker.damageTaken || 0) + ap;
        if (blocker.damageTaken >= bt && !blockerIndestructible) {
          this.moveToGraveyard(blocker.id, defendingPlayer.id);
        }
      }

      if (this.hasAbility(attacker, 'trample') || this.hasAbility(attacker, 'arrollar')) {
        const excess = ap - bt; // Trample excess ignores damageTaken for simplicity unless we want to track remaining toughness
        if (excess > 0) defendingPlayer.hp -= excess;
      }
    }

    if (!attackerOnly && bp > 0) {
      if (this.hasAbility(blocker, 'lifelink') || this.hasAbility(blocker, 'vínculo vital')) {
        defendingPlayer.hp += bp;
      }

      if (blockerDeathtouch) {
        if (!attackerIndestructible) {
          console.log(`💀 ${attacker.name} destruido por toque mortal de ${blocker.name}`);
          this.moveToGraveyard(attacker.id, activePlayer.id);
        }
      } else {
        attacker.damageTaken = (attacker.damageTaken || 0) + bp;
        console.log(`💥 ${attacker.name} recibe ${bp} de daño de ${blocker.name}. Total recibido: ${attacker.damageTaken}/${at}`);
        if (attacker.damageTaken >= at && !attackerIndestructible) {
          console.log(`💀 ${attacker.name} muere por daño letal.`);
          this.moveToGraveyard(attacker.id, activePlayer.id);
        }
      }
    }
  }

  public getModifiedPower(card: GameCard, player: PlayerGameState): number {
    let p = parseInt(card.power || '0');
    const counters = (card as any).counters || 0;
    p += counters;

    player.field.forEach(perm => {
      const text = (perm.oracleText || '').toLowerCase();
      // Generic P/T modifiers (+1/+1, +2/+2, etc.)
      const ptMatch = text.match(/creatures you control get ([+-]\d+)\/([+-]\d+)/);
      if (ptMatch) {
        p += parseInt(ptMatch[1]);
      }
      
      // Specific Lord effects (simplification)
      if (text.includes('other creatures you control get +1/+1') && perm.id !== card.id) {
        p += 1;
      }
    });
    return p;
  }

  public getModifiedToughness(card: GameCard, player: PlayerGameState): number {
    let t = parseInt(card.toughness || '0');
    // Sumar contadores
    const counters = (card as any).counters || 0;
    t += counters;

    player.field.forEach(perm => {
      const text = (perm.oracleText || '').toLowerCase();
      const ptMatch = text.match(/creatures you control get ([+-]\d+)\/([+-]\d+)/);
      if (ptMatch) {
        t += parseInt(ptMatch[2]);
      }
      if (text.includes('other creatures you control get +1/+1') && perm.id !== card.id) {
        t += 1;
      }
    });
    return t;
  }

  private returnToHand(cardId: string, playerId: string): void {
    const state = this.gameStateSubject.value;
    if (!state) return;
    const isP1 = state.player1.id === playerId;
    const p = isP1 ? state.player1 : state.player2;
    const index = p.field.findIndex(c => c.id === cardId);
    if (index !== -1) {
      const card = p.field.splice(index, 1)[0];
      p.hand.push(card);
      p.handCount = p.hand.length;
    }
  }

  private moveToGraveyard(cardId: string, playerId: string): void {
    const state = this.gameStateSubject.value;
    if (!state) return;
    const isP1 = state.player1.id === playerId;
    const p = isP1 ? state.player1 : state.player2;
    const index = p.field.findIndex(c => c.id === cardId);
    if (index !== -1) {
      const card = p.field.splice(index, 1)[0];
      card.isAttacking = false;
      card.isBlocking = false;
      card.blockingTargetId = undefined;
      card.damageTaken = 0; // Reset damage in graveyard
      
      p.graveyard.push(card);
      p.graveyardCount = p.graveyard.length;
      p.field = [...p.field]; // Force new reference
      console.log(`🪦 Carta ${card.name} movida al cementerio de ${p.username}.`);
    } else {
      console.warn(`⚠️ No se pudo encontrar la carta ${cardId} en el campo de ${p.username} para moverla al cementerio.`);
    }
  }

  confirmBlockerOrder(attackerId: string, orderedBlockerIds: string[]): void {
    const state = this.gameStateSubject.value;
    if (!state || !state.pendingBlockerOrders) return;

    // Only allow active player to set orders
    if (state.activePlayerId !== this.me()?.id) return;

    const activePlayer = state.player1.id === state.activePlayerId ? state.player1 : state.player2;
    const attacker = activePlayer.field.find(c => c.id === attackerId);
    if (attacker) {
      (attacker as any).orderedBlockers = orderedBlockerIds;
    }

    state.pendingBlockerOrders = state.pendingBlockerOrders.filter(o => o.attackerId !== attackerId);
    if (state.pendingBlockerOrders.length === 0) {
      state.pendingBlockerOrders = undefined;
      // All ordered, resume combat resolution!
      this.resolveCombat();
      
      // Check if we need to advance phase if resolveCombat finished and didn't pause again
      if (!this.gameStateSubject.value?.pendingBlockerOrders) {
         this.nextPhase();
      }
    } else {
      this.gameStateSubject.next({ ...state });
      this.updateState({}, true);
    }
  }

  private fightSequential(attacker: GameCard, blockers: GameCard[], activePlayer: PlayerGameState, defendingPlayer: PlayerGameState): void {
    let remainingAttackerDamage = this.getModifiedPower(attacker, activePlayer);
    const order = (attacker as any).orderedBlockers || blockers.map(b => b.id);
    
    // Sort blockers based on the defined order
    const sortedBlockers = [...blockers].sort((a, b) => {
      const idxA = order.indexOf(a.id);
      const idxB = order.indexOf(b.id);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });

    sortedBlockers.forEach(blocker => {
      const blockerPower = this.getModifiedPower(blocker, defendingPlayer);
      const blockerToughness = this.getModifiedToughness(blocker, defendingPlayer);
      const remainingBlockerToughness = Math.max(0, blockerToughness - (blocker.damageTaken || 0));

      // Attacker deals damage to blocker
      if (remainingAttackerDamage > 0) {
        const damageToAssign = Math.min(remainingAttackerDamage, remainingBlockerToughness);
        // In MTG, you must assign at least lethal to the first before moving to second.
        // If it's the last blocker, it takes all remaining damage.
        const isLast = blocker === sortedBlockers[sortedBlockers.length - 1];
        const finalDamage = isLast ? remainingAttackerDamage : damageToAssign;

        blocker.damageTaken = (blocker.damageTaken || 0) + finalDamage;
        remainingAttackerDamage -= finalDamage;
        console.log(`💥 ${attacker.name} hace ${finalDamage} de daño a ${blocker.name}. (Restante: ${remainingAttackerDamage})`);
        
        if (blocker.damageTaken >= blockerToughness) {
          console.log(`💀 ${blocker.name} muere por daño de ${attacker.name}`);
          this.moveToGraveyard(blocker.id, defendingPlayer.id);
        }
      }

      // Blocker deals damage back to attacker (simultaneous)
      const attackerToughness = this.getModifiedToughness(attacker, activePlayer);
      attacker.damageTaken = (attacker.damageTaken || 0) + blockerPower;
      console.log(`💥 ${blocker.name} hace ${blockerPower} de daño a ${attacker.name}. Total: ${attacker.damageTaken}/${attackerToughness}`);
      
      if (attacker.damageTaken >= attackerToughness) {
        console.log(`💀 ${attacker.name} muere por daño de los bloqueadores.`);
        this.moveToGraveyard(attacker.id, activePlayer.id);
      }
    });
  }
}
