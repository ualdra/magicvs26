import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, interval, Subscription } from 'rxjs';
import { GameState, GamePhase, GameCard, PlayerGameState, ManaPool, AnimationStatus, StackItem, AnimationEvent } from '../../models/game.model';
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

  public lastMatchResult: any = null;
  private isConceding = false;

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

    if (!state.spellsCastThisTurn) {
      state.spellsCastThisTurn = {};
    }

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
        if (!this.isProcessing && remoteState) {
          const current = this.gameStateSubject.value;
          if (!current?.winnerId) {
            if ((current as any)._localOnly || (current as any)._syncFailed) return;
            const preservedKeys = ['animationEvents', 'combatStep', '_lastMatchResult', '_pendingAbilityMenu', '_pendingDyadrineChoice', '_pendingBasicLandChoice', 'pendingAnimateChoice', 'pendingTarget', 'pendingXChoice', 'pendingWarpChoice', 'pendingKickerChoice', 'pendingModalChoice', 'pendingSpreeChoice', 'pendingBargainChoice', 'pendingGiftChoice', 'pendingScrySurveilChoice', 'pendingCrewChoice', 'pendingPayLifeChoice', 'pendingOptionalPayChoice', 'pendingSacrificeChoice', 'pendingManaChoice', 'pendingPayment'];
            for (const key of preservedKeys) {
              if ((current as any)[key] !== undefined) {
                (remoteState as any)[key] = (current as any)[key];
              }
            }
            const drop1 = (current as any).player1?._dropping;
            const drop2 = (current as any).player2?._dropping;
            this.gameStateSubject.next(remoteState);
            if (drop1) { const s = this.gameStateSubject.value; if (s?.player1) (s.player1 as any)._dropping = true; }
            if (drop2) { const s = this.gameStateSubject.value; if (s?.player2) (s.player2 as any)._dropping = true; }
          }
          if (remoteState.winnerId && !this.lastMatchResult) {
            if ((remoteState as any)._lastMatchResult) {
              this.lastMatchResult = (remoteState as any)._lastMatchResult;
            } else {
              this.battleService.finishMatch(matchId, remoteState.winnerId).subscribe({
                next: (res) => { if (res) { this.lastMatchResult = res; const s = this.gameStateSubject.value; if (s) { (s as any)._lastMatchResult = res; this.gameStateSubject.next(s); } } },
                error: () => {}
              });
            }
          }
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

      (finalState as any)._syncFailed = true;
      this.gameStateSubject.next(finalState);
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

    if (p.mulliganCount >= 7) {
      this.notificationService.showToast('Límite', 'Máximo 7 mulligans.', 'WARNING');
      return;
    }

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
    
    (currentState as any)._syncFailed = true;
    this.gameStateSubject.next(currentState);
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
      (p as any)._dropping = true;
      const state = this.gameStateSubject.value;
      if (state) { (state as any)._syncFailed = true; this.gameStateSubject.next({ ...state }); }
    }
  }

  dropCardToBottom(cardId: string): void {
    const p = this.me();
    if (!p) return;

    if (!(p as any)._dropping) return;
    const cardIndex = p.hand.findIndex(c => c.id === cardId);
    if (cardIndex !== -1) {
      const card = p.hand.splice(cardIndex, 1)[0];
      p.library.push(card); 
      p.libraryCount = p.library.length;
      p.handCount = p.hand.length;

      const cardsToDrop = p.mulliganCount;
      if (p.hand.length === (7 - cardsToDrop)) {
        p.isReady = true;
        (p as any)._dropping = false;
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

      this.addLogEntry(`Fase: ${nextPhase}.`);

      let newState = { ...state };
      newState.currentPhase = nextPhase;

      // Reset combat states when leaving combat
      if (nextPhase === GamePhase.MAIN_2 || nextPhase === GamePhase.END) {
        newState.combatStep = undefined;
        [newState.player1, newState.player2].forEach(p => {
          p.field = p.field.map(c => ({
            ...c,
            isAttacking: false,
            isBlocking: false,
            blockingTargetId: undefined
          }));
        });
      }
      
      // Reset temp power/toughness modifiers at end of turn
      if (nextPhase === GamePhase.END || (nextIndex >= phases.length && state.currentPhase === GamePhase.END)) {
        [newState.player1, newState.player2].forEach(player => {
          player.field.forEach(c => {
            c.tempPowerModifier = 0;
            c.tempToughnessModifier = 0;
            (c as any).grantedAbilities = [];
          });
        });
      }

      // Warp exile + Cactuar return at beginning of end step
      if (nextPhase === GamePhase.END || (nextIndex >= phases.length && state.currentPhase === GamePhase.END)) {
        [newState.player1, newState.player2].forEach(player => {
          const warped = player.field.filter(c => (c as any).castAsWarped && !(c as any).warpedFromExile);
          warped.forEach(c => {
            (c as any).warpedFromExile = true;
            player.field = player.field.filter(f => f.id !== c.id);
            player.exile.push(c);
            player.exileCount = player.exile.length;
            this.addLogEntry(`Warp — ${c.name} se exilia al final del turno.`);
          });

          const returners = player.field.filter(c => {
            const ct = (c.oracleText || '').toLowerCase();
            if (!ct.includes('return it to its owner\'s hand') && !ct.includes('devuélvela a la mano')) return false;
            if (ct.includes('didn\'t enter the battlefield this turn')) {
              if (c.enteredFieldTurn === state.turnCount) return false;
            }
            return true;
          });
          returners.forEach(c => {
            const ownerState = newState.player1.field.some(f => f.id === c.id) ? newState.player1 : newState.player2;
            ownerState.field = ownerState.field.filter(f => f.id !== c.id);
            ownerState.hand.push(c);
            ownerState.handCount = ownerState.hand.length;
            this.addLogEntry(`${c.name} vuelve a la mano al final del turno.`);
          });
        });
      }

      // Clear mana
      newState.player1 = { ...newState.player1, manaPool: this.createEmptyManaPool() };
      newState.player2 = { ...newState.player2, manaPool: this.createEmptyManaPool() };

      // Priority resets to Active Player on phase change
      newState.priorityPlayerId = newState.activePlayerId;
      newState.passedCount = 0;

      if (nextPhase === GamePhase.COMBAT) {
        newState.combatStep = 'ATTACKERS';
        this.addLogEntry('Comienza el paso de declarar atacantes.');
        this.notificationService.showToast('Declarar Atacantes', 'Puedes declarar atacantes.', 'INFO');
      }

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

      if (state.stack.length > 0) {
        const item = state.stack[state.stack.length - 1];
        this.addLogEntry(`Ambos pasan prioridad. Se resuelve: ${item.name}.`);
        this.resolveTopStackItem(state);
      } else {
        this.nextPhase();
      }
    } else {
      const p = this.me();
      this.addLogEntry(`${p?.username || 'Jugador'} pasa prioridad.`);
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
    this.addLogEntry(`Se resuelve: ${item.name}.`);
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
      
      if (card.exileOnResolution) {
        controller.exile.push(card);
        controller.exileCount = controller.exile.length;
      } else if (card.type?.toLowerCase().includes('instant') || card.type?.toLowerCase().includes('sorcery') || 
          card.type?.toLowerCase().includes('instantáneo') || card.type?.toLowerCase().includes('conjuro')) {
        controller.graveyard.push(card);
        controller.graveyardCount = controller.graveyard.length;
      } else {
        card.enteredFieldTurn = state.turnCount;
        if (card.isPlaneswalker || card.type?.toLowerCase().includes('planeswalker')) {
          const loyaltyLines = (card.oracleText || '').split('\n').filter(l => l.match(/^[+\-−]\d+:/));
          const loyaltyMatch = loyaltyLines.length > 0 ? loyaltyLines[0]?.match(/^[+\-−](\d+):/) : null;
          (card as any).loyalty = card.loyaltyUsedThisTurn ? parseInt(card.toughness || '0') : (loyaltyMatch ? parseInt(loyaltyMatch[1]) : parseInt(card.toughness || '0'));
        }
        if ((card.oracleText || '').toLowerCase().includes('start your engines') || (card.oracleText || '').toLowerCase().includes('start your engines')) {
          controller.speed = 1;
          this.addLogEntry(`${card.name}: Start your engines! Velocidad 1.`);
        }
        const xFromEffect = (item.effect as any)?.xValue || 0;
        if (xFromEffect > 0) {
          if (!card.counters) card.counters = {};
          card.counters['+1/+1'] = (card.counters['+1/+1'] || 0) + xFromEffect;
          this.addLogEntry(`${card.name} entra con ${xFromEffect} contadores +1/+1.`);
        }
        controller.field.push(card);

        const isEnchantment = card.type?.toLowerCase().includes('enchantment') || card.type?.toLowerCase().includes('encantamiento');
        if (isEnchantment) {
          controller.field.forEach(perm => {
            if (perm.id !== card.id && perm.oracleText?.toLowerCase().includes('eerie')) {
              this.notificationService.showToast('¡Eerie!', `${perm.name} se activa por Eerie.`, 'SUCCESS');
            }
          });
        }

        if ((card.oracleText || '').toLowerCase().includes('whenever this vehicle enters or attacks') && !(card as any)._vehicleSearchResolved) {
          (card as any)._vehicleSearchResolved = true;
          const basicLands = controller.library.filter(lc => {
            const lt = (lc.type || '').toLowerCase();
            return lt.includes('basic') || ['Forest','Plains','Island','Swamp','Mountain','Bosque','Llanura','Isla','Pantano','Montaña'].includes(lc.name);
          });
          if (basicLands.length > 0) {
            const chosenLand = basicLands[0];
            const li = controller.library.indexOf(chosenLand);
            if (li !== -1) controller.library.splice(li, 1);
            chosenLand.isTapped = true;
            controller.field.push(chosenLand);
            controller.libraryCount = controller.library.length;
            this.addLogEntry(`${controller.username} busca ${chosenLand.name} con ${card.name}.`);
          }
        }

        if ((card.oracleText || '').toLowerCase().includes('enters with a +1/+1 counter') && !(card as any)._etbCounterResolved) {
          (card as any)._etbCounterResolved = true;
          if (!card.counters) card.counters = {};
          card.counters['+1/+1'] = (card.counters['+1/+1'] || 0) + 1;
          this.addLogEntry(`${card.name} entra con un contador +1/+1.`);
        }

        const coyoteMatch = (card.oracleText || '').toLowerCase().match(/gets \+1\/\+1 and gains haste/);
        if (coyoteMatch && !(card as any)._coyoteResolved) {
          (card as any)._coyoteResolved = true;
          state.pendingTarget = {
            sourceCardId: card.id,
            validTargets: 'CREATURE',
            effect: 'COYOTE_BUFF',
            value: 0
          };
          this.notificationService.showToast('Coyote', 'Selecciona otra criatura para darle +1/+1 y prisa.', 'INFO');
          this.isProcessing = false;
          this.gameStateSubject.next({ ...state });
          return;
        }

        const flightMatch = (card.oracleText || '').toLowerCase().match(/put a \+1\/\+1 counter.*gains flying.*prevent all combat damage/);
        if (flightMatch && !(card as any)._flightResolved) {
          (card as any)._flightResolved = true;
          state.pendingTarget = {
            sourceCardId: card.id,
            validTargets: 'CREATURE',
            effect: 'FLIGHT_BUFF',
            value: 0
          };
          this.notificationService.showToast('Fleeting Flight', 'Selecciona una criatura objetivo.', 'INFO');
          this.isProcessing = false;
          this.gameStateSubject.next({ ...state });
          return;
        }

        if ((item as any).kicked && (card.oracleText || '').toLowerCase().includes('if it was kicked')) {
          this.notificationService.showToast('¡Estímulo!', `${card.name} entra estimulada.`, 'SUCCESS');
          state.pendingSacrificeChoice = {
            playerId: state.player1.id === controller.id ? state.player2.id : state.player1.id,
            count: 1,
            validTypes: 'CREATURE',
            sourceCardId: card.id
          };
          this.addLogEntry(`${card.name}: el rival sacrifica una criatura.`);
          this.isProcessing = false;
          this.gameStateSubject.next({ ...state });
          return;
        }

        const debuffMatch = (card.oracleText || '').toLowerCase().match(/gets ([-–]\d+)\/([-–]\d+)/);
        if (debuffMatch && !(card as any)._debuffResolved) {
          (card as any)._debuffResolved = true;
          const pMod = parseInt(debuffMatch[1]) || 0;
          const tMod = parseInt(debuffMatch[2]) || 0;
          state.pendingTarget = {
            sourceCardId: card.id,
            validTargets: 'CREATURE',
            effect: 'DEBUFF',
            value: pMod * 100 + (tMod < 0 ? Math.abs(tMod) : 0)
          };
          (card as any)._debuffPower = pMod;
          (card as any)._debuffToughness = tMod;
          this.notificationService.showToast('Debuff', 'Selecciona una criatura para debuffear.', 'INFO');
          this.isProcessing = false;
          this.gameStateSubject.next({ ...state });
          return;
        }

        const payMatch = (card.oracleText || '').toLowerCase().match(/you may pay \{(\d+)\}/);
        if (payMatch && !(card as any)._payOptionalResolved) {
          (card as any)._payOptionalResolved = true;
          const costVal = payMatch[1];
          state.pendingOptionalPayChoice = {
            cardId: card.id,
            cost: [costVal],
            description: `Pagar {${costVal}} para activar efecto?`,
            onPay: { effectType: 'TAP_STUN', validTargets: 'CREATURE' },
            onDecline: 'No pagar'
          };
          this.notificationService.showToast('Pago opcional', `Puedes pagar {${costVal}}.`, 'INFO');
          this.isProcessing = false;
          this.gameStateSubject.next({ ...state });
          return;
        }

        const enteringName = (card.name || '').toLowerCase();
        const enteringType = (card.type || '').toLowerCase();
        const isDwarf = enteringType.includes('dwarf') || enteringType.includes('enano') || enteringName.includes('dwarf') || enteringName.includes('enano');
        const isEquipment = enteringType.includes('equipment') || enteringType.includes('equipo');
        if (isDwarf || isEquipment) {
          controller.field.forEach(perm => {
            const permName = (perm.name || '').toLowerCase();
            if (perm.id !== card.id && (permName.includes('giott') || permName.includes('giott'))) {
              this.notificationService.showToast('Giott', `${perm.name} se activa por ${card.name}.`, 'SUCCESS');
              this.addLogEntry(`Giott: puedes descartar una carta para robar.`);
            }
          });
        }

        const tapUntapMatch = (card.oracleText || '').toLowerCase().match(/you may tap or untap target creature/);
        if (tapUntapMatch && !(card as any)._tapUntapResolved) {
          (card as any)._tapUntapResolved = true;
          state.pendingTarget = {
            sourceCardId: card.id,
            validTargets: 'CREATURE',
            effect: 'TAP',
            value: 0
          };
          this.notificationService.showToast('Elige', 'Selecciona criatura para girar/enderezar.', 'INFO');
          this.isProcessing = false;
          this.gameStateSubject.next({ ...state });
          return;
        }

        const otAnimate = (card.oracleText || '').toLowerCase();
        console.log('🔍 Earthbend check:', { name: card.name, text: otAnimate.substring(0, 100), match: otAnimate.match(/(?:controla la tierra|earthbend)\s*(\d+)/) });
        const animMatch = otAnimate.match(/(?:controla la tierra|earthbend)\s*(\d+)/);
        if (animMatch) {
          const count = parseInt(animMatch[1]) || 1;
          state.pendingAnimateChoice = { sourceCardId: card.id, count, selectedLandIds: [], playerId: controller.id };
          this.notificationService.showToast('Animar tierra', `Selecciona ${count} tierra(s) para animar.`, 'INFO');
          this.isProcessing = false;
          this.gameStateSubject.next({ ...state });
          return;
        }
      }
    }
    
    if (item.card && (item.card as any).castAsAdventure && ((item.card.adventureOracleText || '')).toLowerCase().includes('create a')) {
      this.createToken(controller, 'Otter Token', 'Creature — Otter', '');
      this.addLogEntry(`${controller.username} crea una ficha 1/1 Otter.`);
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

    const mapUntap = (c: GameCard, shouldUntap: boolean) => {
      if (shouldUntap && c.counters?.['stun'] && c.counters['stun'] > 0) {
        c.counters['stun']--;
        return { ...c, damageTaken: 0 };
      }
      return { ...c, isTapped: shouldUntap ? false : c.isTapped, damageTaken: 0 };
    };
    
    [state.player1, state.player2].forEach(player => {
      player.field.forEach(c => { (c as any)._activatedOnceThisTurn = false; });
    });

    const updatedPlayer1 = {
      ...state.player1,
      field: state.player1.field.map(c => mapUntap(c, isP1))
    };
    
    const updatedPlayer2 = {
      ...state.player2,
      field: state.player2.field.map(c => mapUntap(c, !isP1))
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
    newState = this.advanceDayNightCycle(newState);
    [newState.player1, newState.player2].forEach(player => {
      const warped = player.field.filter(c => (c as any).castAsWarped && !(c as any).warpedFromExile);
      warped.forEach(c => {
        (c as any).warpedFromExile = true;
        player.field = player.field.filter(f => f.id !== c.id);
        player.exile.push(c);
        player.exileCount = player.exile.length;
        this.addLogEntry(`Warp — ${c.name} se exilia al final del turno.`);
      });
    });

    newState.activePlayerId = nextPlayerId;
    this.addLogEntry(`Turno ${newState.turnCount + 1} — ${nextPlayerId === state.player1.id ? state.player1.username : state.player2.username}.`);
    newState.currentPhase = GamePhase.UNTAP;
    newState.landsPlayedThisTurn = 0;
    newState.spellsCastThisTurn = {};
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

    const canPlayLandsFromGY = p.field.some(c =>
      (c.oracleText || '').toLowerCase().includes('you may play lands from your graveyard') ||
      (c.oracleText || '').toLowerCase().includes('puedes jugar tierras desde tu cementerio')
    );

    let cardIndex = p.hand.findIndex(c => c.id === cardId);
    let fromGraveyard = false;
    let fromExile = false;
    if (cardIndex === -1) {
      cardIndex = p.graveyard.findIndex(c => c.id === cardId);
      const graveCard = cardIndex !== -1 ? p.graveyard[cardIndex] : null;
      const isGraveLand = graveCard && ((graveCard.type || '').toLowerCase().includes('land') || (graveCard.type || '').toLowerCase().includes('tierra'));
      if (graveCard && (graveCard.oracleText?.toLowerCase().includes('flashback') || graveCard.oracleText?.toLowerCase().includes('escape') || (isGraveLand && canPlayLandsFromGY))) {
        fromGraveyard = true;
      } else {
        if (graveCard && isGraveLand) {
          this.notificationService.showToast('No permitido', 'No tienes una carta que permita jugar tierras desde el cementerio.', 'WARNING');
          this.isProcessing = false;
          return;
        }
        cardIndex = p.exile.findIndex(c => c.id === cardId);
        if (cardIndex !== -1 && ((p.exile[cardIndex] as any).warpedFromExile || (p.exile[cardIndex] as any).playableUntilEndOfNextTurn || p.exile[cardIndex].isPlotted)) {
          fromExile = true;
        } else {
          this.isProcessing = false;
          return;
        }
      }
    }
    const card = fromGraveyard ? p.graveyard[cardIndex] : fromExile ? p.exile[cardIndex] : p.hand[cardIndex];
    if (fromGraveyard) {
      card.exileOnResolution = true;
    }
    if (fromExile) {
      (card as any).warpedFromExile = false;
      card.exileOnResolution = false;
    }

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
        const canPlayExtraLand = p.field.some(c =>
          (c.oracleText || '').toLowerCase().includes('you may play an additional land') ||
          (c.oracleText || '').toLowerCase().includes('puedes jugar una tierra adicional')
        );
        const maxLands = canPlayExtraLand ? 2 : 1;
        if (state.landsPlayedThisTurn >= maxLands) {
          this.notificationService.showToast('Acción bloqueada', 'Ya has bajado el máximo de tierras este turno.', 'WARNING');
          this.isProcessing = false;
          return;
        }

        if (card.oracleText?.toLowerCase().includes('you may pay 2 life') || card.oracleText?.toLowerCase().includes('pagar 2 vidas')) {
          if (!(card as any)._payLifeResolved) {
            state.pendingPayLifeChoice = {
              cardId: card.id,
              lifeCost: 2,
              description: 'Pagar 2 vidas o entrar girada'
            };
            this.gameStateSubject.next({ ...state });
            return;
          }
        }
        
        const otLand = (card.oracleText || '').toLowerCase();
        if (otLand.includes('enters tapped unless') && !otLand.includes('you may pay')) {
          const controlsBasic = p.field.some(fc => {
            const ft = (fc.type || '').toLowerCase();
            return ft.includes('basic') || ['Forest','Plains','Island','Swamp','Mountain','Bosque','Llanura','Isla','Pantano','Montaña'].includes(fc.name);
          });
          if (!controlsBasic) card.isTapped = true;
        }

        if (fromGraveyard) {
          p.graveyard.splice(cardIndex, 1);
          p.graveyardCount = p.graveyard.length;
        } else if (fromExile) {
          p.exile.splice(cardIndex, 1);
          p.exileCount = p.exile.length;
        } else {
          p.hand.splice(cardIndex, 1);
          p.handCount = p.hand.length;
        }
        p.field.push(card);
        this.addLogEntry(`${p.username} juega tierra: ${card.name}.`);
        this.triggerLandfall(p, state);
        this.refreshVariablePowers();
        this.updateState({ landsPlayedThisTurn: state.landsPlayedThisTurn + 1 }, true, () => {
          this.isProcessing = false;
        });
      } else {
        if (card.isAdventure && !(card as any).castAsAdventure && !(card as any).advResolved && !state.pendingAdventureChoice) {
          state.pendingAdventureChoice = {
            cardId: card.id,
            creatureCost: card.manaCost || [],
            adventureCost: card.adventureManaCost || [],
            adventureName: card.adventureName || ''
          };
          this.gameStateSubject.next({ ...state });
          return;
        }

        if (card.isMdfc && (card as any).mdfcFaceSelected === undefined && !state.pendingMdfcChoice && !(card as any).mdfcResolved) {
          (card as any).mdfcResolved = true;
        }

        const xParsed = this.parseManaCost(card.manaCost || []);
        if (xParsed.hasX && !(card as any).xValue && !state.pendingXChoice) {
          state.pendingXChoice = { cardId: card.id, baseCost: card.manaCost || [] };
          this.gameStateSubject.next({ ...state });
          return;
        }

        const isAura = (card.type || '').toLowerCase().includes('aura');
        const isEquipment = (card.type || '').toLowerCase().includes('equipment') || (card.type || '').toLowerCase().includes('equipo');
        if ((isAura || isEquipment) && !(card as any)._attachTargetSet && !state.pendingTarget) {
          (card as any)._attachTargetSet = true;
          state.pendingTarget = {
            sourceCardId: card.id,
            validTargets: 'CREATURE',
            effect: isAura ? 'ATTACH_AURA' : 'ATTACH_EQUIP',
            value: 0
          };
          this.notificationService.showToast(isEquipment ? 'Equipar' : 'Encantar', `Selecciona una criatura objetivo para ${isEquipment ? 'equipar' : 'encantar'}.`, 'INFO');
          return;
        }

        const warpMatch = card.oracleText?.toLowerCase().match(/warp\s*((?:\{[^}]+\})+)/);
        if (warpMatch && !(card as any).castAsWarped && !(card as any)._warpChoiceResolved && !state.pendingWarpChoice) {
          const warpSymbols = warpMatch[1].match(/\{[^}]+\}/g) || [];
          state.pendingWarpChoice = {
            cardId: card.id,
            normalCost: card.manaCost || [],
            warpCost: warpSymbols
          };
          this.gameStateSubject.next({ ...state });
          return;
        }

        const kickerMatch = card.oracleText?.toLowerCase().match(/kicker ((?:\{[^}]+\})+)/);
        if (kickerMatch && !(card as any).kicked && !state.pendingKickerChoice) {
          const kickerSymbols = kickerMatch[1].match(/\{[^}]+\}/g) || [];
          state.pendingKickerChoice = { cardId: card.id, kickerCost: kickerSymbols };
          this.gameStateSubject.next({ ...state });
          return;
        }

        let effectiveManaCost = card.manaCost || [];
        if ((card as any).castAsAdventure && card.adventureManaCost) {
          effectiveManaCost = card.adventureManaCost;
        }
        if ((card as any).castAsWarped) {
          const storedCost = (card as any)._warpCost;
          if (storedCost) effectiveManaCost = storedCost;
        }
        const xVal = (card as any).xValue || 0;
        if (xVal > 0) {
          effectiveManaCost = effectiveManaCost.filter(s => s.toUpperCase().replace(/{|}/g, '') !== 'X');
          effectiveManaCost.push(`${xVal}`);
        }

        const costReq = this.parseManaCost(effectiveManaCost);
        if ((card as any).kicked && kickerMatch) {
          const kickerSymbols = kickerMatch[1].match(/\{[^}]+\}/g) || [];
          const kickerCost = this.parseManaCost(kickerSymbols);
          costReq.generic += kickerCost.generic;
          costReq.white += kickerCost.white;
          costReq.blue += kickerCost.blue;
          costReq.black += kickerCost.black;
          costReq.red += kickerCost.red;
          costReq.green += kickerCost.green;
          costReq.colorless += kickerCost.colorless;
        }

        const hasConvoke = card.oracleText?.toLowerCase().includes('convoke');
        const hasDelve = card.oracleText?.toLowerCase().includes('delve');

        let convokeDiscount = 0;
        if (hasConvoke) {
          const untappedCreatures = p.field.filter(c => !c.isTapped && (c.type?.toLowerCase().includes('creature') || c.type?.toLowerCase().includes('criatura')));
          convokeDiscount = Math.min(untappedCreatures.length, costReq.generic);
          for (let i = 0; i < convokeDiscount; i++) {
            untappedCreatures[i].isTapped = true;
          }
        }

        let delveDiscount = 0;
        if (hasDelve) {
          delveDiscount = Math.min(p.graveyard.length, costReq.generic - convokeDiscount);
          for (let i = 0; i < delveDiscount; i++) {
            p.exile.push(p.graveyard.splice(0, 1)[0]);
            p.exileCount = p.exile.length;
            p.graveyardCount = p.graveyard.length;
          }
        }

        costReq.generic = Math.max(0, costReq.generic - convokeDiscount - delveDiscount);

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

    let cardIndex = p.hand.findIndex(c => c.id === cardId);
    let fromGraveyard = false;
    let fromExile = false;
    if (cardIndex === -1) {
      cardIndex = p.graveyard.findIndex(c => c.id === cardId);
      if (cardIndex !== -1) {
        fromGraveyard = true;
      } else {
        cardIndex = p.exile.findIndex(c => c.id === cardId);
        if (cardIndex !== -1) {
          fromExile = true;
        } else {
          return;
        }
      }
    }

    const sourceArray = fromGraveyard ? p.graveyard : fromExile ? p.exile : p.hand;
    const card = sourceArray[cardIndex];
    const effectText = (card as any).castAsAdventure && card.adventureOracleText ? card.adventureOracleText : card.oracleText || '';
    const effect = this.parseCardEffect({ ...card, oracleText: effectText });

    const isSpell = this.isSpell(card);

    if (isSpell && effect && effect.needsTarget && !this.selectedTargetId) {
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

    const xVal = (card as any).xValue || 0;
    const stackItem: StackItem = {
      id: Math.random().toString(36).substr(2, 9),
      sourceCardId: card.id,
      controllerId: p.id,
      type: 'SPELL',
      name: card.name,
      card: { ...card },
      imageUrl: card.imageUrl,
      effect: { ...(effect || {}), xValue: xVal },
      kicked: (card as any).kicked || false,
      targetId: this.selectedTargetId,
      targetType: this.selectedTargetType
    };

    this.selectedTargetId = undefined;
    this.selectedTargetType = undefined;
    sourceArray.splice(cardIndex, 1);
    if (fromGraveyard) {
      p.graveyardCount = sourceArray.length;
    } else if (fromExile) {
      p.exileCount = sourceArray.length;
    } else {
      p.handCount = sourceArray.length;
    }

    const newStack = [...state.stack, stackItem];

    state.pendingPayment = undefined;
    state.pendingTarget = undefined;

    if (!state.spellsCastThisTurn) state.spellsCastThisTurn = {};
    const currentCount = state.spellsCastThisTurn[p.id] || 0;
    state.spellsCastThisTurn[p.id] = currentCount + 1;

    this.addLogEntry(`${p.username} lanza ${card.name}${(card as any).kicked ? ' (con Estímulo)' : ''}.`);

    if (currentCount + 1 === 2 && (effect?.effect === 'FLURRY_TRIGGER')) {
      this.notificationService.showToast('¡Flurry!', `${card.name} desencadena Furía.`, 'SUCCESS');
    }

    this.updateState({ 
      stack: newStack,
      passedCount: 0 
    }, true, () => {
      this.isProcessing = false;
    });
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
      const caster = state.player1.id === item.controllerId ? state.player1 : state.player2;
      const oppHasHexproof = (targetPlayer.field || []).some(c =>
        (c.oracleText || '').toLowerCase().includes('you have hexproof') || (c.oracleText || '').toLowerCase().includes('tienes hexproof')
      );
      if (oppHasHexproof && caster.id !== targetPlayer.id) {
        this.addLogEntry(`Jugador tiene Hexproof, el hechizo es contrarrestado.`);
        return;
      }
      if (effect === 'DAMAGE') {
        targetPlayer.hp -= value;
        [state.player1, state.player2].forEach(player => {
          if (player.speed && player.speed < 4 && !player.dealtDamageThisTurn) {
            player.speed++;
            player.dealtDamageThisTurn = true;
            if (player.speed >= 4) player.maxSpeedReached = true;
            this.addLogEntry(`Velocidad aumenta a ${player.speed}.`);
          }
        });
      } else if (effect === 'INFECT') {
        targetPlayer.poisonCounters = (targetPlayer.poisonCounters || 0) + value;
      }
      return;
    }

    const controller = item.controllerId === state.player1.id ? state.player1 : state.player2;

    if (effect === 'REANIMATE') {
      const graveIndex = controller.graveyard.findIndex(c => c.id === targetId);
      if (graveIndex !== -1) {
        const card = controller.graveyard.splice(graveIndex, 1)[0];
        card.enteredFieldTurn = state.turnCount;
        card.damageTaken = 0;
        const sourceText = (item.card?.oracleText || '').toLowerCase();
        if (sourceText.includes('tapped') || sourceText.includes('girada')) {
          card.isTapped = true;
        }
        this.pushAnimation({ cardId: card.id, type: 'reanimate', duration: 1000, message: card.name });
        controller.field.push(card);
        controller.graveyardCount = controller.graveyard.length;
        this.addLogEntry(`${controller.username} reanima ${card.name}.`);
      }
      return;
    }

    const p1Card = state.player1.field.find(c => c.id === targetId);
    const p2Card = state.player2.field.find(c => c.id === targetId);
    const targetCard = p1Card || p2Card;
    const ownerId = p1Card ? state.player1.id : state.player2.id;

    if (!targetCard) return;

    if (item.card && (item.card.type?.toLowerCase().includes('aura') || item.card.type?.toLowerCase().includes('encantamiento'))) {
      item.card.attachedToCardId = targetCard.id;
      if (!targetCard.attachedCardIds) targetCard.attachedCardIds = [];
      if (!targetCard.attachedCardIds.includes(item.card.id)) {
        targetCard.attachedCardIds.push(item.card.id);
      }
      return;
    }

    if (effect === 'DAMAGE') {
      const ownerOfTarget = state.player1.field.some(c => c.id === targetId) ? state.player1 : state.player2;
      const preventsNonCombat = ownerOfTarget.field.some(c =>
        (c.oracleText || '').toLowerCase().includes('prevent all noncombat damage')
      );
      if (preventsNonCombat && targetCard.id !== 'self') {
        this.addLogEntry(`Daño no de combate prevenido por ${preventsNonCombat}.`);
        return;
      }
      const t = parseInt(targetCard.toughness || '0');
      const dmg = (targetCard.damageTaken || 0) + value;
      const prevention = (targetCard as any).damagePrevention || 0;
      const actualDmg = Math.max(0, dmg - prevention);
      if (actualDmg !== dmg) {
        (targetCard as any).damagePrevention = Math.max(0, prevention - dmg);
      }
      if (t - actualDmg <= 0) {
        this.moveToGraveyard(targetCard.id, ownerId);
      } else {
        targetCard.damageTaken = actualDmg;
      }
    } else if (effect === 'DESTROY') {
      this.moveToGraveyard(targetCard.id, ownerId);
      const destroyedOwner = ownerId === state.player1.id ? state.player1 : state.player2;
      if (item.card && (item.card.oracleText || '').toLowerCase().includes('its controller may search')) {
        const basicLands = destroyedOwner.library.filter(lc => {
          const lt = (lc.type || '').toLowerCase();
          return lt.includes('basic') || ['Forest','Plains','Island','Swamp','Mountain','Bosque','Llanura','Isla','Pantano','Montaña'].includes(lc.name);
        });
        if (basicLands.length > 0) {
          const chosen = basicLands[0];
          const idx = destroyedOwner.library.indexOf(chosen);
          if (idx !== -1) destroyedOwner.library.splice(idx, 1);
          chosen.isTapped = true;
          destroyedOwner.field.push(chosen);
          destroyedOwner.libraryCount = destroyedOwner.library.length;
          this.addLogEntry(`${destroyedOwner.username} busca ${chosen.name} (Corroer).`);
          this.notificationService.showToast('Corroer', `${destroyedOwner.username} busca una tierra básica.`, 'INFO');
        } else {
          this.addLogEntry(`${destroyedOwner.username} no tiene tierras básicas en la biblioteca.`);
        }
      }
    } else if (effect === 'BOUNCE') {
      this.returnToHand(targetCard.id, ownerId);
    } else if (effect === 'TAP') {
      targetCard.isTapped = true;
    } else if (effect === 'TAP_STUN') {
      targetCard.isTapped = true;
      if (!targetCard.counters) targetCard.counters = {};
      targetCard.counters['stun'] = (targetCard.counters['stun'] || 0) + 1;
      this.addLogEntry(`${targetCard.name} recibe un contador de aturdimiento.`);
    } else if (effect === 'UNTAP') {
      targetCard.isTapped = false;
    } else if (effect === 'FLICKER') {
      const exile = ownerId === state.player1.id ? state.player1.exile : state.player2.exile;
      const field = ownerId === state.player1.id ? state.player1.field : state.player2.field;
      const idx = field.findIndex(c => c.id === targetCard.id);
      if (idx !== -1) {
        field.splice(idx, 1);
        targetCard.damageTaken = 0;
        targetCard.isTapped = false;
        targetCard.isAttacking = false;
        targetCard.isBlocking = false;
        targetCard.blockingTargetId = undefined;
        field.push(targetCard);
      }
      this.pushAnimation({ cardId: targetCard.id, type: 'flicker', duration: 800, message: 'Flicker!' });
      this.pushAnimation({ cardId: targetCard.id, type: 'counter_plus1', duration: 600 });
      if (!targetCard.counters) targetCard.counters = {};
      targetCard.counters['+1/+1'] = (targetCard.counters['+1/+1'] || 0) + 1;
      this.addLogEntry(`${targetCard.name} vuelve con un contador +1/+1.`);
    } else if (effect === 'PREVENT_DAMAGE') {
      (targetCard as any).damagePrevention = ((targetCard as any).damagePrevention || 0) + (value as number);
    } else if (effect === 'GIVE_ABILITY') {
      const ability = value as string;
      const existing = (targetCard as any).grantedAbilities || [];
      existing.push(ability);
      (targetCard as any).grantedAbilities = existing;
      const newText = (targetCard.oracleText || '') + `, ${ability}`;
      targetCard.oracleText = newText;
    } else if (effect === 'BUFF') {
      if (!targetCard.counters) targetCard.counters = {};
      const buffVal = typeof value === 'number' ? value : 1;
      targetCard.counters['+1/+1'] = (targetCard.counters['+1/+1'] || 0) + buffVal;
      if (buffVal > 1) {
        const existingAbilities = (targetCard as any).grantedAbilities || [];
        if (!existingAbilities.includes('indestructible')) {
          existingAbilities.push('indestructible');
          (targetCard as any).grantedAbilities = existingAbilities;
          targetCard.oracleText = (targetCard.oracleText || '') + ', indestructible';
        }
      }
    }
  }

  private parseCardEffect(card: GameCard): any {
    const text = (card.oracleText || '').toLowerCase();
    
    // 1. Draw cards
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

    // 3. Destruction
    if (text.includes('destroy target creature')) {
      return { effect: 'DESTROY', validTargets: 'CREATURE', needsTarget: true };
    }

    // 4. Bounce
    if (text.includes('return target creature to its owner\'s hand') || text.includes('devuelve la criatura objetivo a la mano')) {
      return { effect: 'BOUNCE', validTargets: 'CREATURE', needsTarget: true };
    }

    // 5. RAMP / ADD_MANA: "Add {G}", "Add {W}{W}", "Add one mana of any color"
    const addManaMatch = text.match(/add (\{(\w)\}\s*)+/);
    if (addManaMatch) {
      const symbols = [...text.matchAll(/\{(\w)\}/g)].map(m => m[1]);
      if (symbols.length > 0) {
        return { effect: 'ADD_MANA', value: symbols, needsTarget: false };
      }
    }
    if (text.includes('add one mana of any color')) {
      return { effect: 'ADD_MANA', value: ['any'], needsTarget: false };
    }

    // 5b. Flurry / Eerie — second spell trigger
    if (text.includes('flurry') || text.includes('furia')) {
      return { effect: 'FLURRY_TRIGGER', needsTarget: false };
    }
    if (text.includes('eerie') || text.includes('escalofrío')) {
      return { effect: 'EERIE_TRIGGER', needsTarget: false };
    }

    // 5c. Equip: handled as an activated ability
    const equipMatch = text.match(/equip \{(\d+)\}/);
    if (equipMatch && card.type?.toLowerCase().includes('equipment')) {
      return { effect: 'EQUIP', value: parseInt(equipMatch[1]), needsTarget: false };
    }

    // 6. TAP_TARGET: "Tap target creature"
    if ((text.includes('tap target creature') || text.includes('tap target permanent')) && !text.includes('untap')) {
      return { effect: 'TAP', validTargets: 'CREATURE', needsTarget: true };
    }

    // 7. UNTAP_TARGET: "Untap target creature"
    if (text.includes('untap target creature') || text.includes('untap target permanent')) {
      return { effect: 'UNTAP', validTargets: 'CREATURE', needsTarget: true };
    }

    // 8. PREVENT_DAMAGE: "Prevent the next X damage that would be dealt to target creature"
    const preventMatch = text.match(/prevent the next (\d+) damage/);
    if (preventMatch) {
      return { effect: 'PREVENT_DAMAGE', value: parseInt(preventMatch[1]), validTargets: 'CREATURE', needsTarget: true };
    }

    // 9. GIVE_ABILITY: "Target creature gains [ability] until end of turn"
    const gainAbilityMatch = text.match(/target creature gains (\w+(?:\s+\w+)?) until/);
    if (gainAbilityMatch) {
      return { effect: 'GIVE_ABILITY', value: gainAbilityMatch[1], validTargets: 'CREATURE', needsTarget: true };
    }

    // 10. REANIMATE
    if (text.includes('return target creature card from your graveyard to the battlefield') ||
        text.includes('return target creature from graveyard to battlefield')) {
      return { effect: 'REANIMATE', validTargets: 'CREATURE', needsTarget: true };
    }

    // 11. Scry: "Scry N"
    const scryMatch = text.match(/scry (\d+)/);
    if (scryMatch) {
      return { effect: 'SCRY', value: parseInt(scryMatch[1]), needsTarget: false };
    }

    // 12. Surveil: "Surveil N"
    const surveilMatch = text.match(/surveil (\d+)/);
    if (surveilMatch) {
      return { effect: 'SURVEIL', value: parseInt(surveilMatch[1]), needsTarget: false };
    }

    // 13. Infect: deals damage as poison counters
    if (text.includes('infect')) {
      const dmgMatch = text.match(/deal (\d+) damage/);
      if (dmgMatch) {
        let targets: any = 'ANY';
        if (text.includes('target creature or player')) targets = 'ANY';
        else if (text.includes('target creature')) targets = 'CREATURE';
        else if (text.includes('target player')) targets = 'PLAYER';
        return { effect: 'INFECT', value: parseInt(dmgMatch[1]), validTargets: targets, needsTarget: true };
      }
    }

    // 14. Flicker: "Exile target creature, then return it to the battlefield"
    if (text.includes('exile target creature') && (text.includes('return it to the battlefield') || text.includes('return it to play'))) {
      return { effect: 'FLICKER', validTargets: 'CREATURE', needsTarget: true };
    }

    // 15. Sacrifice: "Sacrifice a creature"
    if (text.includes('sacrifice a creature') || text.includes('sacrifice a permanent')) {
      return { effect: 'SACRIFICE', value: text.includes('permanent') ? 'PERMANENT' : 'CREATURE', needsTarget: false };
    }

    // 14. Cascade: "Cascade"
    if (text.includes('cascade')) {
      return { effect: 'CASCADE', needsTarget: false };
    }

    // 15. Discover: "Discover N"
    const discoverMatch = text.match(/discover (\d+)/);
    if (discoverMatch) {
      return { effect: 'DISCOVER', value: parseInt(discoverMatch[1]), needsTarget: false };
    }

    // 16. Modal: "Choose one —"
    if (text.includes('choose one —') || text.includes('choose one -') || text.includes('elige uno') || text.includes('•')) {
      const sep = text.includes('—') ? '—' : text.includes('–') ? '–' : text.includes('-') ? '-' : null;
      let modes: string[] = [];
      if (text.includes('•')) {
        modes = text.split('•').map(m => m.trim()).filter(Boolean);
        const header = modes[0] || '';
        if (header.includes('choose one') || header.includes('elige uno') || header.includes('elige una')) {
          modes = modes.slice(1);
        }
      } else if (sep) {
        modes = text.split(sep)[1]?.split('•').map(m => m.trim()).filter(Boolean) || [];
      }
      if (modes.length > 0) {
        return { effect: 'MODAL', value: modes, needsTarget: false, modeCount: 1 };
      }
    }
    if (text.includes('choose two —') || text.includes('choose two -') || text.includes('elige dos')) {
      const sep = text.includes('—') ? '—' : text.includes('–') ? '–' : text.includes('-') ? '-' : null;
      let modes: string[] = [];
      if (text.includes('•')) {
        modes = text.split('•').map(m => m.trim()).filter(Boolean);
        const header = modes[0] || '';
        if (header.includes('choose two') || header.includes('elige dos')) {
          modes = modes.slice(1);
        }
      } else if (sep) {
        modes = text.split(sep)[1]?.split('•').map(m => m.trim()).filter(Boolean) || [];
      }
      if (modes.length > 0) {
        return { effect: 'MODAL', value: modes, needsTarget: false, modeCount: 2 };
      }
    }

    // 17. Spree: "Spree —" with options
    if (text.includes('spree')) {
      const after = text.split('spree')[1] || '';
      const options = after.split('•').map(m => {
        const costMatch = m.match(/\{([^}]+)\}/);
        return { cost: costMatch ? [costMatch[1]] : [], text: m.trim() };
      }).filter(o => o.text.length > 0);
      if (options.length > 0) {
        return { effect: 'SPREE', value: options, needsTarget: false };
      }
    }

    // 18. Bargain: if oracle text includes "bargain"
    if (text.includes('bargain')) {
      const afterBargain = text.split('bargain')[1] || '';
      return { effect: 'BARGAIN', value: afterBargain.trim().substring(0, 80), needsTarget: false };
    }

    // 19. Gift: if oracle text includes "gift"
    if (text.includes('gift')) {
      return { effect: 'GIFT', needsTarget: false };
    }

    return null;
  }

  private executeNonTargetEffect(effect: any, player: PlayerGameState): void {
    if (effect.effect === 'DRAW') {
      for (let i = 0; i < effect.value; i++) {
        this.drawCardToPlayer(player);
      }
      this.notificationService.showToast('Robo', `Has robado ${effect.value} cartas.`, 'SUCCESS');
    } else if (effect.effect === 'ADD_MANA') {
      const symbols = effect.value as string[];
      if (symbols.length === 1 && symbols[0] === 'any') {
        player.manaPool.colorless = (player.manaPool.colorless || 0) + 1;
        this.notificationService.showToast('Mana', 'Añadiste 1 maná de cualquier color (incoloro por defecto).', 'SUCCESS');
        return;
      }
      for (const sym of symbols) {
        const color = this.manaSymbolToColor(sym);
        if (color) {
          player.manaPool[color] = (player.manaPool[color] || 0) + 1;
        }
      }
      this.notificationService.showToast('Mana', `Añadiste ${symbols.length} maná.`, 'SUCCESS');
    } else if (effect.effect === 'SCRY' || effect.effect === 'SURVEIL') {
      const value = effect.value as number;
      const topCards = player.library.slice(0, value);
      if (topCards.length === 0) return;
      const state = this.gameStateSubject.value;
      if (!state) return;
      state.pendingScrySurveilChoice = {
        playerId: player.id,
        type: effect.effect === 'SCRY' ? 'SCRY' : 'SURVEIL',
        cards: topCards,
        value: value,
        sourceCardId: ''
      };
    } else if (effect.effect === 'SACRIFICE') {
      const state = this.gameStateSubject.value;
      if (!state) return;
      state.pendingSacrificeChoice = {
        playerId: player.id,
        count: 1,
        validTypes: effect.value as 'CREATURE' | 'PERMANENT',
      };
    } else if (effect.effect === 'CASCADE') {
      const state = this.gameStateSubject.value;
      if (!state) return;
      this.executeCascade(player, state);
    } else if (effect.effect === 'DISCOVER') {
      const state = this.gameStateSubject.value;
      if (!state) return;
      this.executeCascade(player, state, effect.value as number);
    } else if (effect.effect === 'MODAL') {
      const state = this.gameStateSubject.value;
      if (!state) return;
      state.pendingModalChoice = {
        cardId: state.stack?.[state.stack.length - 1]?.sourceCardId || '',
        modeCount: effect.modeCount || 1,
        modes: (effect.value as string[]).map((m: string) => ({ text: m, effect: '' })),
        playerId: player.id
      };
      this.gameStateSubject.next({ ...state });
      this.isProcessing = false;
    } else if (effect.effect === 'SPREE') {
      const state = this.gameStateSubject.value;
      if (!state) return;
      state.pendingSpreeChoice = {
        cardId: state.stack?.[state.stack.length - 1]?.sourceCardId || '',
        spreeOptions: effect.value as { cost: string[]; text: string }[]
      };
    } else if (effect.effect === 'BARGAIN') {
      const state = this.gameStateSubject.value;
      if (!state) return;
      state.pendingBargainChoice = {
        cardId: state.stack?.[state.stack.length - 1]?.sourceCardId || '',
        bargainEffect: effect.value as string
      };
    } else if (effect.effect === 'GIFT') {
      const state = this.gameStateSubject.value;
      if (!state) return;
      state.pendingGiftChoice = {
        cardId: state.stack?.[state.stack.length - 1]?.sourceCardId || '',
        giftDescription: ''
      };
    }
  }

  private manaSymbolToColor(sym: string): keyof ManaPool | null {
    const map: Record<string, keyof ManaPool> = {
      'w': 'white', 'u': 'blue', 'b': 'black', 'r': 'red', 'g': 'green', 'c': 'colorless'
    };
    return map[sym.toLowerCase()] || null;
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
    const req: any = { white: 0, blue: 0, black: 0, red: 0, green: 0, colorless: 0, generic: 0, hasX: false };
    cost.forEach(s => {
      const v = s.toUpperCase().replace(/{|}/g, '');
      if (v === 'W') req.white++;
      else if (v === 'U') req.blue++;
      else if (v === 'B') req.black++;
      else if (v === 'R') req.red++;
      else if (v === 'G') req.green++;
      else if (v === 'C') req.colorless++;
      else if (v === 'X') req.hasX = true;
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

  cancelCardPlay(): void {
    const state = this.gameStateSubject.value;
    if (!state) return;
    const p = this.me();
    if (!p) return;
    const pendingKeys = ['pendingAdventureChoice', 'pendingWarpChoice', 'pendingXChoice', 'pendingKickerChoice', 'pendingCrewChoice', '_pendingBasicLandChoice', '_pendingDyadrineChoice', '_localOnly'];
    for (const key of pendingKeys) {
      if ((state as any)[key]) {
        const choice = (state as any)[key];
        if (!choice || !choice.cardId) { (state as any)[key] = undefined; continue; }
        const cardId = choice.cardId;
        const card = p.hand.find(c => c.id === cardId);
        if (card) {
          delete (card as any).castAsAdventure;
          delete (card as any).xValue;
          delete (card as any).kicked;
          delete (card as any).castAsWarped;
          delete (card as any)._payLifeResolved;
          delete (card as any).advResolved;
        }
        (state as any)[key] = undefined;
      }
    }
    this.isProcessing = false;
    this.gameStateSubject.next({ ...state });
  }

  cancelPayment(): void {
    const state = this.gameStateSubject.value;
    if (!state) return;
    
    if (state.pendingPayment) {
      this.isProcessing = false;
      this.refreshGameState();
      return;
    }
    
    const payLife = state.pendingPayLifeChoice;
    if (payLife) {
      const p = this.me();
      if (p) {
        const card = p.hand.find(c => c.id === payLife.cardId);
        if (card) (card as any)._payLifeResolved = false;
      }
      state.pendingPayLifeChoice = undefined;
      this.isProcessing = false;
      this.gameStateSubject.next({ ...state });
      return;
    }
    
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

  getCardActivatedAbilities(cardId: string): { index: number; costLabel: string; effectLabel: string }[] {
    const state = this.gameStateSubject.value;
    if (!state) return [];
    const p = this.me();
    if (!p) return [];
    const card = p.field.find(c => c.id === cardId);
    if (!card || !card.oracleText) return [];

    const results: { index: number; costLabel: string; effectLabel: string }[] = [];
    let idx = 0;
    for (const line of card.oracleText.split('\n')) {
      const trimmed = line.trim();
      const match = trimmed.match(/^(\{.*?\}(?:\s*\{[^}]+\})*(?:\s*,\s*\{T\})?(?:\s*,\s*(?:sacrificar|sacrifice)[^:]*)?):\s*(.+)/i);
      if (match) {
        results.push({ index: idx, costLabel: match[1].trim(), effectLabel: match[2].trim() });
        idx++;
      }
    }
    return results;
  }

  activateAbility(cardId: string, abilityIndex: number): void {
    const state = this.gameStateSubject.value;
    if (!state || this.isProcessing) return;
    const p = this.me();
    if (!p) return;
    const card = p.field.find(c => c.id === cardId);
    if (!card || !card.oracleText) return;

    const abilities = this.getCardActivatedAbilities(cardId);
    const ability = abilities[abilityIndex];
    if (!ability) return;

    const costLabel = ability.costLabel.toLowerCase();
    const effectLabel = ability.effectLabel.toLowerCase();

    const manaMatch = costLabel.match(/\{[^}]+\}/g);
    const manaSymbols = manaMatch ? manaMatch.filter(s => s.toUpperCase() !== '{T}') : [];
    const needsTap = costLabel.includes('{t}');
    const needsSacrifice = costLabel.includes('sacrificar') || costLabel.includes('sacrifice');

    if (needsTap && card.isTapped) {
      this.notificationService.showToast('No disponible', 'La carta ya está girada.', 'WARNING');
      return;
    }

    const costReq = this.parseManaCost(manaSymbols);
    if (!this.canAffordParsed(costReq, p.manaPool)) {
      this.notificationService.showToast('Falta maná', 'No tienes suficiente maná para activar esta habilidad.', 'WARNING');
      return;
    }

    if (effectLabel.includes('activate only once') || effectLabel.includes('activa solo una vez')) {
      if ((card as any)._activatedOnceThisTurn) {
        this.notificationService.showToast('Ya activada', 'Esta habilidad solo se activa una vez por turno.', 'WARNING');
        this.isProcessing = false;
        return;
      }
      (card as any)._activatedOnceThisTurn = true;
    }

    this.isProcessing = true;

    this.paySpecificCosts(costReq, p.manaPool);
    const remainingGeneric = costReq.generic;
    let genericPaid = 0;
    if (remainingGeneric > 0) {
      const colors: (keyof ManaPool)[] = ['colorless', 'white', 'blue', 'black', 'red', 'green'];
      for (const c of colors) {
        const spend = Math.min(p.manaPool[c] || 0, remainingGeneric - genericPaid);
        if (spend > 0) {
          p.manaPool[c] = (p.manaPool[c] || 0) - spend;
          genericPaid += spend;
        }
        if (genericPaid >= remainingGeneric) break;
      }
    }

    if (needsTap) {
      card.isTapped = true;
    }

    if (needsSacrifice) {
      p.field = p.field.filter(c => c.id !== cardId);
      card.isAttacking = false; card.isBlocking = false; card.damageTaken = 0;
      p.graveyard.push(card);
      p.graveyardCount = p.graveyard.length;
      this.addLogEntry(`${p.username} sacrifica ${card.name}.`);
    }

    this.addLogEntry(`${p.username} activa habilidad de ${card.name}.`);
    this.pushAnimation({ cardId: card.id, type: 'activate_ability', duration: 600, message: card.name });

    if (effectLabel.includes('busca') || effectLabel.includes('search')) {
      this.searchBasicLand(p, card, effectLabel.includes('enderezar') || effectLabel.includes('untap'));
      const s2 = this.gameStateSubject.value;
      if (s2 && (s2 as any)._pendingBasicLandChoice) { (s2 as any)._localOnly = true; this.isProcessing = false; this.gameStateSubject.next({ ...s2 }); return; }
    } else if (effectLabel.includes('exilia') || effectLabel.includes('exile')) {
      const gyTarget = [...p.graveyard, ...(this.opponent()?.graveyard || [])][0];
      if (gyTarget) {
        if (p.graveyard.includes(gyTarget)) {
          p.graveyard = p.graveyard.filter(c => c.id !== gyTarget.id);
          p.graveyardCount = p.graveyard.length;
        } else {
          const opp = this.opponent();
          if (opp) { opp.graveyard = opp.graveyard.filter(c => c.id !== gyTarget.id); opp.graveyardCount = opp.graveyard.length; }
        }
        p.exile.push(gyTarget);
        p.exileCount = p.exile.length;
        const curators = p.field.filter(c => (c.name || '').toLowerCase().includes('keen-eyed') || (c.name || '').toLowerCase().includes('conservador'));
        curators.forEach(cur => {
          if (!(cur as any).exiledCardIds) (cur as any).exiledCardIds = [];
          if (!(cur as any).exiledCardIds.includes(gyTarget.id)) (cur as any).exiledCardIds.push(gyTarget.id);
        });
        this.addLogEntry(`${p.username} exilia ${gyTarget.name} del cementerio.`);
        this.isProcessing = false;
        this.updateState({}, true);
      } else {
        this.notificationService.showToast('Sin objetivo', 'No hay cartas en cementerios.', 'INFO');
        this.isProcessing = false;
        this.updateState({}, true);
      }
    } else if (effectLabel.includes('no puede ser bloqueada') || effectLabel.includes('unblockable') || effectLabel.includes('can\'t be blocked')) {
      state.pendingActivatedAbility = {
        cardId, abilityIndex,
        costMana: manaSymbols, needsTap, needsSacrifice,
        effectType: 'UNBLOCKABLE', targetCount: 1
      };
      this.notificationService.showToast('Selecciona objetivo', 'Elige una criatura para darle imbloqueable.', 'INFO');
      this.gameStateSubject.next({ ...state });
    } else if (effectLabel.includes('controla la tierra') || effectLabel.includes('animate') || effectLabel.includes('earthbend')) {
      this.handleActivatedAnimateLand(card, effectLabel);
    } else if (/add|añade|añadir/i.test(effectLabel)) {
      const el = effectLabel.toLowerCase();
      const coloredManaMap: Record<string, keyof ManaPool> = {
        '{g}': 'green', '{r}': 'red', '{w}': 'white', '{u}': 'blue', '{b}': 'black', '{c}': 'colorless',
      };
      let added = false;
      for (const [sym, pool] of Object.entries(coloredManaMap)) {
        if (el.includes(sym)) {
          p.manaPool[pool] = (p.manaPool[pool] || 0) + 1; added = true;
        }
      }
      if (added) {
        this.addLogEntry(`${p.username} añade maná con ${card.name}.`);
        this.isProcessing = false;
        this.updateState({}, true);
      } else {
        this.isProcessing = false;
        this.updateState({}, true);
      }
    } else if (effectLabel.includes('+x/+0') || effectLabel.includes('+x/+0') || (effectLabel.includes('gete') && effectLabel.includes('+x/'))) {
      const toughness = parseInt(card.toughness || '0');
      const boost = toughness + (card.tempToughnessModifier || 0);
      card.tempPowerModifier = (card.tempPowerModifier || 0) + boost;
      this.addLogEntry(`${card.name} obtiene +${boost}/+0 hasta el final del turno.`);
      this.isProcessing = false;
      this.updateState({}, true);
    } else if (effectLabel.includes('indestructible') && effectLabel.includes('target')) {
      state.pendingActivatedAbility = {
        cardId, abilityIndex,
        costMana: manaSymbols, needsTap, needsSacrifice,
        effectType: 'GIVE_INDESTRUCTIBLE', targetCount: 1
      };
      this.notificationService.showToast('Selecciona objetivo', 'Elige un Aliado para darle indestructible.', 'INFO');
      this.gameStateSubject.next({ ...state });
    } else if (effectLabel.includes('draw a card') || effectLabel.includes('roba una carta')) {
      this.drawCardToPlayer(p);
      if (effectLabel.includes('treasure') || effectLabel.includes('tesoro')) {
        this.createToken(p, 'Treasure', 'Artifact — Treasure', '{T}, Sacrifice this artifact: Add one mana of any color.');
      }
      this.isProcessing = false;
      this.updateState({}, true);
    } else if (effectLabel.includes('create') || effectLabel.includes('crea')) {
      if (effectLabel.includes('cat') || effectLabel.includes('gato')) {
        this.createToken(p, 'Cat Token', 'Creature — Cat', 'Lifelink');
      }
      this.isProcessing = false;
      this.updateState({}, true);
    } else if (effectLabel.includes('no puede ser bloqueada') || effectLabel.includes('can\'t be blocked')) {
      (card as any).tempUnblockable = true;
      this.addLogEntry(`${card.name} no puede ser bloqueada excepto por criaturas con prisa.`);
      this.isProcessing = false;
      this.updateState({}, true);
    } else {
      this.isProcessing = false;
      this.updateState({}, true);
    }
  }

  private handleActivatedAbilityTarget(targetId: string): void {
    const state = this.gameStateSubject.value;
    if (!state?.pendingActivatedAbility) return;
    const p = this.me();
    if (!p) return;
    const pending = state.pendingActivatedAbility;

    const targetCard = [...state.player1.field, ...state.player2.field].find(c => c.id === targetId);
    if (!targetCard) return;

    if (pending.effectType === 'GIVE_INDESTRUCTIBLE') {
      const existingAbilities = (targetCard as any).grantedAbilities || [];
      if (!existingAbilities.includes('indestructible')) {
        existingAbilities.push('indestructible');
        (targetCard as any).grantedAbilities = existingAbilities;
        targetCard.oracleText = (targetCard.oracleText || '') + ', indestructible';
        this.addLogEntry(`${targetCard.name} obtiene indestructible.`);
      }
    } else if (pending.effectType === 'UNBLOCKABLE') {
      const powerVal = parseInt(targetCard.power || '0');
      if (powerVal > 2) {
        this.notificationService.showToast('Objetivo inválido', 'Solo criaturas con fuerza 2 o menos.', 'WARNING');
        return;
      }
      targetCard.tempUnblockable = true;
      this.addLogEntry(`${targetCard.name} no puede ser bloqueada este turno.`);
    }

    state.pendingActivatedAbility = undefined;
    this.isProcessing = false;
    this.updateState({}, true);
  }

  selectGraveyardTarget(cardId: string): void {
    const state = this.gameStateSubject.value;
    if (!state?.pendingActivatedAbility) return;
    const p = this.me();
    if (!p) return;
    const pending = state.pendingActivatedAbility;

    if (pending.effectType !== 'EXILE_GY') return;

    const gyCard = p.graveyard.find(c => c.id === cardId) || state.player1.graveyard.find(c => c.id === cardId);
    if (!gyCard) return;

    if (p.graveyard.includes(gyCard)) {
      p.graveyard = p.graveyard.filter(c => c.id !== cardId);
      p.graveyardCount = p.graveyard.length;
    } else {
      const opp = this.opponent();
      if (opp) {
        opp.graveyard = opp.graveyard.filter(c => c.id !== cardId);
        opp.graveyardCount = opp.graveyard.length;
      }
    }
    if (!gyCard.isAnimated) {
      p.exile.push(gyCard);
      p.exileCount = p.exile.length;
    }
    this.addLogEntry(`${p.username} exilia ${gyCard.name} del cementerio.`);

    state.pendingActivatedAbility = undefined;
    this.isProcessing = false;
    this.updateState({}, true);
  }

  private translateLabel(text: string): string {
    const replacements: [RegExp, string][] = [
      [/\{T\}/g, '{Girar}'],
      [/sacrifice this land/gi, 'sacrificar esta tierra'],
      [/sacrifice this creature/gi, 'sacrificar esta criatura'],
      [/sacrifice this artifact/gi, 'sacrificar este artefacto'],
      [/sacrifice this token/gi, 'sacrificar esta ficha'],
      [/search your library/gi, 'busca en tu biblioteca'],
      [/basic land/gi, 'tierra básica'],
      [/put it onto the battlefield tapped/gi, 'ponla al campo girada'],
      [/then if you control four or more lands, untap that land/gi, 'si controlas 4+ tierras, enderézala'],
      [/then shuffle/gi, 'luego baraja'],
      [/untap that land/gi, 'endereza esa tierra'],
      [/target creature/gi, 'criatura objetivo'],
      [/target player/gi, 'jugador objetivo'],
      [/target creature or planeswalker/gi, 'criatura o planeswalker objetivo'],
      [/draw a card/gi, 'roba una carta'],
      [/create a treasure/gi, 'crea un tesoro'],
      [/create a clue/gi, 'crea una pista'],
      [/exile target/gi, 'exilia objetivo'],
      [/add an additional/gi, 'agrega un adicional'],
      [/activate only once each turn/gi, 'activa solo una vez por turno'],
      [/activate only as a sorcery/gi, 'activa solo como conjuro'],
      [/earthbend/gi, 'controlar tierra'],
      [/can't be blocked/gi, 'no puede ser bloqueada'],
      [/this creature gets/gi, 'esta criatura obtiene'],
      [/this land enters tapped unless/gi, 'esta tierra entra girada a menos que'],
      [/you may pay 2 life/gi, 'puedes pagar 2 vidas'],
      [/you may pay/gi, 'puedes pagar'],
      [/enters the battlefield tapped/gi, 'entra al campo girada'],
      [/exert/gi, 'esforzar'],
      [/until end of turn/gi, 'hasta el final del turno'],
      [/gains indestructible/gi, 'obtiene indestructible'],
      [/gains hexproof/gi, 'obtiene hexproof'],
      [/gains flying/gi, 'obtiene volar'],
      [/gains haste/gi, 'obtiene prisa'],
      [/it gets\b/gi, 'obtiene'],
      [/\bpower\b/gi, 'fuerza'],
      [/\btoughness\b/gi, 'resistencia'],
      [/\bexile\b/gi, 'exiliar'],
      [/\bgraveyard\b/gi, 'cementerio'],
      [/\blibrary\b/gi, 'biblioteca'],
      [/\bbattlefield\b/gi, 'campo de batalla'],
    ];
    let result = text;
    for (const [pattern, replacement] of replacements) {
      result = result.replace(pattern, replacement);
    }
    return result;
  }

  private showAbilityMenu(cardId: string, abilities: { index: number; costLabel: string; effectLabel: string }[]): void {
    const state = this.gameStateSubject.value;
    if (!state) return;
    const translated = abilities.map(a => ({
      ...a,
      costLabel: this.translateLabel(a.costLabel),
      effectLabel: this.translateLabel(a.effectLabel),
    }));
    (state as any)._pendingAbilityMenu = { cardId, abilities: translated };
    this.gameStateSubject.next({ ...state });
  }

  selectAbility(index: number): void {
    const state = this.gameStateSubject.value;
    if (!state || !(state as any)._pendingAbilityMenu) return;
    const menu = (state as any)._pendingAbilityMenu;
    (state as any)._pendingAbilityMenu = undefined;
    if (index === -1) {
      const card = [...state.player1.field, ...state.player2.field].find(c => c.id === menu.cardId);
      if (card) { this.produceManaFromCard(card); return; }
    }
    this.activateAbility(menu.cardId, index);
  }

  cancelAbilityMenu(): void {
    const state = this.gameStateSubject.value;
    if (!state) return;
    (state as any)._pendingAbilityMenu = undefined;
    this.gameStateSubject.next({ ...state });
  }

  private handleActivatedAnimateLand(card: GameCard, effectLabel: string): void {
    const state = this.gameStateSubject.value;
    const p = this.me();
    if (!state || !p) return;

    const animMatch = (effectLabel + ' ').match(/\d+/);
    const count = animMatch ? parseInt(animMatch[0]) : 1;
    state.pendingAnimateChoice = { sourceCardId: card.id, count, selectedLandIds: [], playerId: p.id };
    this.notificationService.showToast('Animar tierra', `Selecciona ${count} tierra(s) para animar.`, 'INFO');
    this.gameStateSubject.next({ ...state });
  }

  private searchBasicLand(p: PlayerGameState, card: GameCard, untapIfFour: boolean): void {
    const state = this.gameStateSubject.value;
    if (!state) return;
    const basicLands = p.library.filter(c => {
      const type = (c.type || '').toLowerCase();
      return type.includes('basic') || c.name === 'Forest' || c.name === 'Plains' ||
             c.name === 'Island' || c.name === 'Swamp' || c.name === 'Mountain' ||
             c.name === 'Bosque' || c.name === 'Llanura' || c.name === 'Isla' ||
             c.name === 'Pantano' || c.name === 'Montaña';
    });

    if (basicLands.length === 0) {
      this.notificationService.showToast('Sin objetivo', 'No hay tierras básicas en la biblioteca.', 'INFO');
      this.isProcessing = false;
      this.updateState({}, true);
      return;
    }

    const names = [...new Set(basicLands.map(l => l.name))];
    if (names.length > 1) {
      (state as any)._pendingBasicLandChoice = { lands: basicLands, playerId: p.id, untapIfFour, names };
      this.isProcessing = false;
      this.gameStateSubject.next({ ...state });
      return;
    }

    const chosen = basicLands[0];
    this.finishSearchLand(p, chosen, untapIfFour, state);
  }

  handleBasicLandChoice(chosenName: string): void {
    const state = this.gameStateSubject.value;
    if (!state || !(state as any)._pendingBasicLandChoice) return;
    const choice = (state as any)._pendingBasicLandChoice;
    const p = choice.playerId === state.player1.id ? state.player1 : state.player2;
    const land = choice.lands.find((l: any) => l.name === chosenName);
    if (land && p) this.finishSearchLand(p, land, choice.untapIfFour, state);
    (state as any)._pendingBasicLandChoice = undefined;
    (state as any)._localOnly = false;
    this.isProcessing = false;
    this.updateState({}, true);
  }

  private finishSearchLand(p: PlayerGameState, chosen: GameCard, untapIfFour: boolean, state: GameState): void {
    const idx = p.library.findIndex(c => c.id === chosen.id);
    if (idx !== -1) p.library.splice(idx, 1);
    chosen.isTapped = true;
    if (untapIfFour) {
      const landCount = p.field.filter(c => {
        const ct = (c.type || '').toLowerCase();
        return ct.includes('land') || ct.includes('tierra');
      }).length;
      if (landCount >= 4) chosen.isTapped = false;
    }
    p.field.push(chosen);
    p.libraryCount = p.library.length;
    this.addLogEntry(`${p.username} busca ${chosen.name} y la pone al campo.`);
    this.triggerLandfall(p, state);
    this.isProcessing = true;
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

    if (state.pendingActivatedAbility) {
      this.handleActivatedAbilityTarget(cardId);
      return;
    }

    if (state.pendingAnimateChoice) {
      this.handleAnimateLandSelection(cardId);
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

    if (myCard) {
      const abilities = this.getCardActivatedAbilities(cardId);
      const hasNonManaAbilities = abilities.some(a => a.costLabel !== '{T}' || !a.effectLabel.toLowerCase().includes('add'));
      const isLand = (myCard.type || '').toLowerCase().includes('land');
      const isVehicle = (myCard.type || '').toLowerCase().includes('vehicle') || (myCard.type || '').toLowerCase().includes('vehiculo');
      const crewMatch = (myCard.oracleText || '').toLowerCase().match(/crew (\d+)/);

      if (abilities.length > 0 && hasNonManaAbilities && state.currentPhase !== GamePhase.COMBAT) {
        if (isLand) {
          const hasManaAbility = abilities.some(a => /^\{t\}$/i.test(a.costLabel) && (a.effectLabel.toLowerCase().includes('add') || a.effectLabel.toLowerCase().includes('añade')));
          if (!hasManaAbility) {
            const manaOption = (myCard.producedMana || []).length > 0 ? {
              index: -1,
              costLabel: '{T}',
              effectLabel: `Añadir {${myCard.producedMana![0].replace(/[{}]/g, '')}}`
            } : null;
            this.showAbilityMenu(cardId, manaOption ? [manaOption, ...abilities] : abilities);
          } else {
            this.showAbilityMenu(cardId, abilities);
          }
          return;
        }
        if (!isVehicle || !crewMatch) {
          this.showAbilityMenu(cardId, abilities);
          return;
        }
      }

      if (isVehicle && crewMatch && state.currentPhase !== GamePhase.COMBAT) {
        const requiredPower = parseInt(crewMatch[1]);
        const validCrew = p.field.filter(c => !c.isTapped && (c.type || '').toLowerCase().includes('creature') && c.id !== myCard.id);
        if (validCrew.length > 0) {
          state.pendingCrewChoice = {
            vehicleId: myCard.id,
            requiredPower,
            tappedCreatureIds: validCrew.slice(0, requiredPower).map(c => c.id)
          };
          this.notificationService.showToast('Tripular', `Necesitas ${requiredPower} de poder.`, 'INFO');
          this.gameStateSubject.next({ ...state });
          return;
        }
      }
    }

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
    if ((req === 'CREATURE' || req === 'MY_CREATURE') && targetType !== 'CREATURE') {
      this.notificationService.showToast('Objetivo inválido', 'Debes elegir una criatura.', 'WARNING');
      return;
    }
    if (req === 'PLAYER' && targetType !== 'PLAYER') {
      this.notificationService.showToast('Objetivo inválido', 'Debes elegir un jugador.', 'WARNING');
      return;
    }

    if (targetType === 'CREATURE') {
      const me = this.me();
      const opp = me?.id === state.player1.id ? state.player2 : state.player1;
      const targetCard = [...state.player1.field, ...state.player2.field].find(c => c.id === targetId);

      [state.player1, state.player2].forEach(player => {
        if (player.field.some(c => (c.name || '').toLowerCase().includes('surrak')) && player.field.some(c => c.id === targetId)) {
          this.drawCardToPlayer(player);
          this.addLogEntry(`Surrak: ${player.username} roba una carta al ser objetivo.`);
        }
      });

      if (targetCard && opp.field.some(c => c.id === targetId) && this.hasAbility(targetCard, 'hexproof')) {
        this.notificationService.showToast('Objetivo inválido', 'Esa criatura tiene Hexproof (no puede ser objetivo).', 'WARNING');
        return;
      }
      if (targetCard && opp.field.some(c => c.id === targetId) && this.hasAbility(targetCard, 'protection')) {
        const sourceCardId = state.pendingTarget?.sourceCardId;
        if (sourceCardId) {
          const sourceCard = [...state.player1.hand, ...state.player1.field, ...state.player2.hand, ...state.player2.field]
            .find(c => c.id === sourceCardId);
          if (this.hasProtectionFromSource(targetCard, sourceCard)) {
            this.notificationService.showToast('Objetivo inválido', 'Esa criatura tiene Protección.', 'WARNING');
            return;
          }
        }
      }
    }

    if (state.pendingFightChoice && !state.pendingFightChoice.myCreatureId && targetType === 'CREATURE') {
      const me = this.me();
      const myField = me?.id === state.player1.id ? state.player1.field : state.player2.field;
      if (myField.some(c => c.id === targetId)) {
        state.pendingFightChoice.myCreatureId = targetId;
        state.pendingTarget = {
          sourceCardId: state.pendingFightChoice.sourceCardId,
          validTargets: 'CREATURE',
          effect: 'DAMAGE',
          value: 0
        };
        this.notificationService.showToast('Elige objetivo', 'Ahora selecciona la criatura enemiga.', 'INFO');
        this.gameStateSubject.next({ ...state });
        return;
      }
    }

    const allFieldCards = [...state.player1.field, ...state.player2.field];
    const targetCard = allFieldCards.find(c => c.id === targetId);
    const p = this.me();
    const pendingEffect = state.pendingTarget?.effect;
    if (pendingEffect === 'ATTACH_AURA' || pendingEffect === 'ATTACH_EQUIP') {
      const sourceId = state.pendingTarget!.sourceCardId;
      const sourceCard = [...state.player1.hand, ...state.player1.field, ...state.player2.hand, ...state.player2.field]
        .find(c => c.id === sourceId);
      if (sourceCard && targetCard) {
        sourceCard.attachedToCardId = targetCard.id;
        if (!targetCard.attachedCardIds) targetCard.attachedCardIds = [];
        if (!targetCard.attachedCardIds.includes(sourceCard.id)) {
          targetCard.attachedCardIds.push(sourceCard.id);
        }
        this.addLogEntry(`${sourceCard.name} se adjunta a ${targetCard.name}.`);

        if (pendingEffect === 'ATTACH_EQUIP') {
          const equipText = (sourceCard.oracleText || '').toLowerCase();
          if (equipText.includes('deathtouch') || equipText.includes('toque mortal')) {
            const existing = (targetCard as any).grantedAbilities || [];
            if (!existing.includes('deathtouch')) { existing.push('deathtouch'); (targetCard as any).grantedAbilities = existing; targetCard.oracleText = (targetCard.oracleText || '') + ', deathtouch'; }
          }
          if (equipText.includes('lifelink') || equipText.includes('vinculo vital')) {
            const existing = (targetCard as any).grantedAbilities || [];
            if (!existing.includes('lifelink')) { existing.push('lifelink'); (targetCard as any).grantedAbilities = existing; targetCard.oracleText = (targetCard.oracleText || '') + ', lifelink'; }
          }
        }

        if (pendingEffect === 'ATTACH_AURA') {
          const auraText = (sourceCard.oracleText || '').toLowerCase();
          if (auraText.includes('gets +1/+0') || auraText.includes('+1/+0')) {
            targetCard.tempPowerModifier = (targetCard.tempPowerModifier || 0) + 1;
          }
          if (auraText.includes('flying') || auraText.includes('vuela')) {
            const existing = (targetCard as any).grantedAbilities || [];
            if (!existing.includes('flying')) {
              existing.push('flying');
              (targetCard as any).grantedAbilities = existing;
              targetCard.oracleText = (targetCard.oracleText || '') + ', flying';
            }
          }
          if (auraText.includes('hexproof')) {
            const existing = (targetCard as any).grantedAbilities || [];
            if (!existing.includes('hexproof')) {
              existing.push('hexproof');
              (targetCard as any).grantedAbilities = existing;
              targetCard.oracleText = (targetCard.oracleText || '') + ', hexproof';
            }
          }
        }
      }
      state.pendingTarget = undefined;
      this.isProcessing = false;
      this.updateState({}, true);
      return;
    }

    if (pendingEffect === 'TAP_STUN') {
      if (targetCard) {
        targetCard.isTapped = true;
        if (!targetCard.counters) targetCard.counters = {};
        targetCard.counters['stun'] = (targetCard.counters['stun'] || 0) + 1;
        this.addLogEntry(`${targetCard.name} recibe un contador de aturdimiento.`);
      }
      state.pendingTarget = undefined;
      state.pendingOptionalPayChoice = undefined;
      this.isProcessing = false;
      this.updateState({}, true);
      return;
    }

    if (state.pendingFightChoice?.myCreatureId && targetType === 'CREATURE') {
      const myId = state.pendingFightChoice.myCreatureId;
      const me = this.me();
      const opp = me?.id === state.player1.id ? state.player2 : state.player1;
      const myCreature = [...state.player1.field, ...state.player2.field].find(c => c.id === myId);
      const oppCreature = [...state.player1.field, ...state.player2.field].find(c => c.id === targetId);
      if (myCreature && oppCreature && opp.field.some(c => c.id === targetId)) {
        const myPower = this.getModifiedPower(myCreature, me!);
        const oppPower = this.getModifiedPower(oppCreature, opp);
        this.pushAnimation({ cardId: myId, type: 'fight', duration: 600, sourceCardId: targetId });
        this.pushAnimation({ cardId: targetId, type: 'fight', duration: 600, sourceCardId: myId });
        myCreature.damageTaken = (myCreature.damageTaken || 0) + oppPower;
        oppCreature.damageTaken = (oppCreature.damageTaken || 0) + myPower;
        this.addLogEntry(`${myCreature.name} lucha contra ${oppCreature.name}.`);
        state.pendingFightChoice = undefined;
        state.pendingTarget = undefined;
        this.updateState({}, true);
        return;
      }
    }

    const isSpellFromHand = state.pendingTarget?.sourceCardId && 
      [state.player1, state.player2].some(p => p.hand.some(c => c.id === state.pendingTarget?.sourceCardId));
    if (!isSpellFromHand && (pendingEffect === 'DAMAGE' || pendingEffect === 'DESTROY')) {
      if (targetCard) {
        const p1 = state.player1.field.some(c => c.id === targetCard.id) ? state.player1 : state.player2;
        const isP1 = p1.id === state.player1.id;
        if (pendingEffect === 'DAMAGE') {
          const dmgVal = state.pendingTarget!.value || 0;
          targetCard.damageTaken = (targetCard.damageTaken || 0) + dmgVal;
          this.addLogEntry(`${targetCard.name} recibe ${dmgVal} de dano.`);
        } else {
          const sourceId = state.pendingTarget?.sourceCardId;
          let canDestroy = true;
          if (sourceId) {
            const sourceCard = [...state.player1.hand, ...state.player1.field, ...state.player2.hand, ...state.player2.field].find(c => c.id === sourceId);
            if (sourceCard) {
              const srcText = (sourceCard.oracleText || '').toLowerCase();
              if (srcText.includes('attacking') || srcText.includes('atacante')) {
                if (!targetCard.isAttacking && !targetCard.isBlocking) {
                  this.notificationService.showToast('Invalido', 'Solo criaturas atacantes o bloqueadoras.', 'WARNING');
                  canDestroy = false;
                }
              }
            }
          }
          if (canDestroy) {
            const destroyedOwner = isP1 ? state.player1 : state.player2;
            this.moveToGraveyard(targetCard.id, destroyedOwner.id);
            this.addLogEntry(`${targetCard.name} es destruido.`);
            const sourceId = state.pendingTarget?.sourceCardId;
            if (sourceId) {
              const sourceCard = [...state.player1.hand, ...state.player1.field, ...state.player2.hand, ...state.player2.field].find(c => c.id === sourceId);
              if (sourceCard && (sourceCard.oracleText || '').toLowerCase().includes('its controller may search')) {
                const basicLands = destroyedOwner.library.filter(lc => {
                  const lt = (lc.type || '').toLowerCase();
                  return lt.includes('basic') || ['Forest','Plains','Island','Swamp','Mountain','Bosque','Llanura','Isla','Pantano','Montaña'].includes(lc.name);
                });
                if (basicLands.length > 0) {
                  const chosen = basicLands[0];
                  const idx = destroyedOwner.library.indexOf(chosen);
                  if (idx !== -1) destroyedOwner.library.splice(idx, 1);
                  chosen.isTapped = true;
                  destroyedOwner.field.push(chosen);
                  destroyedOwner.libraryCount = destroyedOwner.library.length;
                  this.addLogEntry(`${destroyedOwner.username} busca ${chosen.name} (Corroer).`);
                }
              }
            }
          }
        }
      }
      state.pendingTarget = undefined;
      this.isProcessing = false;
      this.updateState({}, true);
      return;
    }

    if (pendingEffect === 'COYOTE_BUFF') {
      if (targetCard) {
        if (!targetCard.counters) targetCard.counters = {};
        targetCard.counters['+1/+1'] = (targetCard.counters['+1/+1'] || 0) + 1;
        const existing = (targetCard as any).grantedAbilities || [];
        if (!existing.includes('haste')) {
          existing.push('haste');
          (targetCard as any).grantedAbilities = existing;
          targetCard.oracleText = (targetCard.oracleText || '') + ', haste';
        }
        targetCard.hasSummoningSickness = false;
        this.addLogEntry(`${targetCard.name}: +1/+1 y prisa.`);
      }
      state.pendingTarget = undefined;
      this.isProcessing = false;
      this.updateState({}, true);
      return;
    }

    if (pendingEffect === 'FLIGHT_BUFF') {
      if (targetCard) {
        if (!targetCard.counters) targetCard.counters = {};
        targetCard.counters['+1/+1'] = (targetCard.counters['+1/+1'] || 0) + 1;
        const existing = (targetCard as any).grantedAbilities || [];
        if (!existing.includes('flying')) {
          existing.push('flying');
          (targetCard as any).grantedAbilities = existing;
          targetCard.oracleText = (targetCard.oracleText || '') + ', flying';
        }
        (targetCard as any).damagePrevention = ((targetCard as any).damagePrevention || 0) + 999;
        this.pushAnimation({ cardId: targetCard.id, type: 'sparkle', duration: 800 });
        this.addLogEntry(`${targetCard.name}: +1/+1, flying, daño de combate prevenido.`);
      }
      state.pendingTarget = undefined;
      this.isProcessing = false;
      this.updateState({}, true);
      return;
    }

    if (!isSpellFromHand && pendingEffect === 'BUFF') {
      if (targetCard) {
        if (!targetCard.counters) targetCard.counters = {};
        const buffVal = state.pendingTarget!.value || 1;
        targetCard.counters['+1/+1'] = (targetCard.counters['+1/+1'] || 0) + buffVal;
        if (buffVal > 1) {
          const existing = (targetCard as any).grantedAbilities || [];
          if (!existing.includes('indestructible')) {
            existing.push('indestructible');
            (targetCard as any).grantedAbilities = existing;
            targetCard.oracleText = (targetCard.oracleText || '') + ', indestructible';
          }
        }
      }
      state.pendingTarget = undefined;
      this.isProcessing = false;
      this.updateState({}, true);
      return;
    }

    if (pendingEffect === 'DEBUFF') {
      if (targetCard) {
        const encoded = state.pendingTarget!.value || 0;
        const pMod = -(Math.floor(encoded / 100));
        const tMod = -(encoded % 100);
        targetCard.tempPowerModifier = (targetCard.tempPowerModifier || 0) + pMod;
        targetCard.tempToughnessModifier = (targetCard.tempToughnessModifier || 0) + tMod;
        this.addLogEntry(`${targetCard.name} obtiene ${pMod}/${tMod} hasta el final del turno.`);
      }
      state.pendingTarget = undefined;
      this.isProcessing = false;
      this.updateState({}, true);
      return;
    }

    if (pendingEffect === 'LANDFALL_DOUBLE_POWER') {
      if (targetCard && p) {
        const isMyCreature = p.field.some(c => c.id === targetId);
        if (!isMyCreature) {
          this.notificationService.showToast('Invalido', 'Solo puedes seleccionar tus propias criaturas.', 'WARNING');
          return;
        }
        const currentPower = this.getModifiedPower(targetCard, p);
        targetCard.tempPowerModifier = (targetCard.tempPowerModifier || 0) + currentPower;
        this.addLogEntry(`Se duplica la fuerza de ${targetCard.name} (${currentPower} → ${currentPower * 2}).`);
      }
      state.pendingTarget = undefined;
      this.isProcessing = false;
      this.updateState({}, true);
      return;
    }

    this.executeTargetEffect(targetId, targetType);
  }

  private executeTargetEffect(targetId: string, targetType: 'CREATURE' | 'PLAYER'): void {
    const state = this.gameStateSubject.value;
    if (!state || !state.pendingTarget) return;

    this.selectedTargetId = targetId;
    this.selectedTargetType = targetType;

    const sourceCardId = state.pendingTarget.sourceCardId;

    if (targetType === 'CREATURE') {
      const targetCard = [...state.player1.field, ...state.player2.field].find(c => c.id === targetId);
      if (targetCard && this.hasAbility(targetCard, 'ward')) {
        const wardCostMatch = (targetCard.oracleText || '').toLowerCase().match(/ward[\s—\-]*\{(\d+)\}/);
        if (wardCostMatch) {
          const caster = this.me();
          state.pendingWardChoice = {
            targetCardId: targetId,
            sourceCardId: sourceCardId,
            wardCost: [wardCostMatch[1]],
            selectedTargetId: this.selectedTargetId,
            selectedTargetType: this.selectedTargetType
          };
          this.gameStateSubject.next({ ...state });
          this.isProcessing = false;
          return;
        }
      }
    }

    state.pendingTarget = undefined; 
    this.finishPlayingCard(sourceCardId);
  }

  handleWardChoice(sourceCardId: string, willPay: boolean): void {
    const state = this.gameStateSubject.value;
    if (!state?.pendingWardChoice) return;

    const caster = this.me();
    if (!caster) return;

    if (willPay) {
      const cost = parseInt(state.pendingWardChoice.wardCost[0]);
      const manaPool = caster.manaPool;
      const totalMana = (manaPool.white || 0) + (manaPool.blue || 0) + (manaPool.black || 0) +
                        (manaPool.red || 0) + (manaPool.green || 0) + (manaPool.colorless || 0);
      if (totalMana >= cost) {
        let remaining = cost;
        for (const color of ['colorless', 'white', 'blue', 'black', 'red', 'green'] as const) {
          const available = manaPool[color] || 0;
          const used = Math.min(available, remaining);
          manaPool[color] = available - used;
          remaining -= used;
          if (remaining <= 0) break;
        }
      }
    }

    state.pendingWardChoice = undefined;
    state.pendingTarget = undefined;
    if (willPay) {
      this.finishPlayingCard(sourceCardId);
    } else {
      this.isProcessing = false;
      this.updateState({}, true);
    }
  }

  handlePayLifeChoice(cardId: string, willPay: boolean): void {
    const state = this.gameStateSubject.value;
    if (!state?.pendingPayLifeChoice) return;
    const p = this.me();
    if (!p) return;
    const card = p.hand.find(c => c.id === cardId);
    if (!card) return;
    (card as any)._payLifeResolved = true;
    if (willPay) {
      p.hp -= 2;
      this.addLogEntry(`${p.username} paga 2 vidas.`);
    } else {
      card.isTapped = true;
      this.addLogEntry(`${card.name} entra girada.`);
    }
    state.pendingPayLifeChoice = undefined;
    this.isProcessing = false;
    this.playCard(cardId);
  }

  getMaxXValue(): number {
    const state = this.gameStateSubject.value;
    if (!state?.pendingXChoice) return 0;
    const p = this.me();
    if (!p) return 0;
    const baseCost = this.parseManaCost(state.pendingXChoice.baseCost);
    const totalMana = (p.manaPool.white || 0) + (p.manaPool.blue || 0) + (p.manaPool.black || 0) +
                       (p.manaPool.red || 0) + (p.manaPool.green || 0) + (p.manaPool.colorless || 0);
    const coloredNeeded = (baseCost.white || 0) + (baseCost.blue || 0) + (baseCost.black || 0) +
                          (baseCost.red || 0) + (baseCost.green || 0) + (baseCost.colorless || 0);
    return Math.max(0, totalMana - coloredNeeded);
  }

  handleXChoice(cardId: string, xValue: number): void {
    const state = this.gameStateSubject.value;
    if (!state?.pendingXChoice) return;
    if (xValue < 0) xValue = 0;
    const p = this.me();
    if (!p) return;
    const maxX = this.getMaxXValue();
    if (xValue > maxX) xValue = maxX;
    const card = p.hand.find(c => c.id === cardId);
    if (card) {
      (card as any).xValue = xValue;
    }
    state.pendingXChoice = undefined;
    this.isProcessing = false;
    this.playCard(cardId);
  }

  handleOptionalPayChoice(cardId: string, willPay: boolean): void {
    const state = this.gameStateSubject.value;
    if (!state?.pendingOptionalPayChoice) return;
    const p = this.me();
    if (!p) return;

    if (willPay) {
      const costReq = this.parseManaCost(state.pendingOptionalPayChoice.cost);
      if (!this.canAffordParsed(costReq, p.manaPool)) {
        this.notificationService.showToast('Falta maná', 'No tienes suficiente maná.', 'WARNING');
        return;
      }
      this.paySpecificCosts(costReq, p.manaPool);
      state.pendingTarget = {
        sourceCardId: cardId,
        validTargets: 'CREATURE',
        effect: 'TAP_STUN',
        value: 0
      };
      this.notificationService.showToast('Elige objetivo', 'Selecciona una criatura para girar.', 'INFO');
      this.gameStateSubject.next({ ...state });
    }

    state.pendingOptionalPayChoice = undefined;
    this.isProcessing = false;
    if (!willPay) this.updateState({}, true);
  }

  handleWarpChoice(cardId: string, useWarp: boolean): void {
    const state = this.gameStateSubject.value;
    if (!state?.pendingWarpChoice) return;
    const p = this.me();
    if (!p) return;

    const card = p.hand.find(c => c.id === cardId);
    if (card) {
      (card as any).castAsWarped = useWarp;
      (card as any)._warpCost = state.pendingWarpChoice.warpCost;
      (card as any)._warpChoiceResolved = true;
    }
    state.pendingWarpChoice = undefined;
    this.isProcessing = false;
    this.playCard(cardId);
  }

  handleAnimateLandSelection(landCardId: string): void {
    const state = this.gameStateSubject.value;
    if (!state?.pendingAnimateChoice) return;
    if (state.pendingAnimateChoice.playerId !== this.me()?.id) return;
    const p = this.me();
    if (!p) return;

    const land = p.field.find(c => c.id === landCardId);
    if (!land) return;
    const isLand = land.type?.toLowerCase().includes('land') || land.type?.toLowerCase().includes('tierra');
    if (!isLand) return;

    if (state.pendingAnimateChoice.selectedLandIds.includes(landCardId)) return;

    state.pendingAnimateChoice.selectedLandIds.push(landCardId);
    land.isAnimated = true;
    land.originalLandType = land.type;
    land.type = (land.type || '') + ' Creature — Land';
    land.power = '0';
    land.toughness = '0';
    if (!land.counters) land.counters = {};
    land.counters['+1/+1'] = (land.counters['+1/+1'] || 0) + 1;
    land.hasSummoningSickness = false;
    const hasteAbilities = (land as any).grantedAbilities || [];
    if (!hasteAbilities.includes('haste')) { hasteAbilities.push('haste'); (land as any).grantedAbilities = hasteAbilities; land.oracleText = (land.oracleText || '') + ', haste'; }
    this.addLogEntry(`Tierra ${land.name} animada como criatura 0/0 con un contador +1/+1.`);

    if (state.pendingAnimateChoice.selectedLandIds.length >= state.pendingAnimateChoice.count) {
      const currentState = this.gameStateSubject.value;
      const srcId = (state as any).pendingAnimateChoice!.sourceCardId;
      const sourceCard = currentState ? p.field.find(c => c.id === srcId) : null;
      if (sourceCard && (sourceCard.oracleText || '').toLowerCase().includes('then search your library')) {
        const basicLands = p.library.filter(lc => {
          const lt = (lc.type || '').toLowerCase();
          return lt.includes('basic') || ['Forest','Plains','Island','Swamp','Mountain','Bosque','Llanura','Isla','Pantano','Montaña'].includes(lc.name);
        });
        if (basicLands.length > 0) {
          const chosenLand = basicLands[0];
          const li = p.library.indexOf(chosenLand);
          if (li !== -1) p.library.splice(li, 1);
          chosenLand.isTapped = true;
          p.field.push(chosenLand);
          p.libraryCount = p.library.length;
          this.addLogEntry(`${p.username} busca ${chosenLand.name} con ${sourceCard.name}.`);
          if (currentState) this.triggerLandfall(p, currentState);
        }
      }
      state.pendingAnimateChoice = undefined;
      this.isProcessing = false;
      this.updateState({}, true);
    } else {
      this.gameStateSubject.next({ ...state });
    }
  }

  handleKickerChoice(cardId: string, kicked: boolean): void {
    const state = this.gameStateSubject.value;
    if (!state?.pendingKickerChoice) return;
    const p = this.me();
    if (!p) return;

    const card = p.hand.find(c => c.id === cardId);
    if (card) {
      (card as any).kicked = kicked;
    }
    state.pendingKickerChoice = undefined;
    this.isProcessing = false;
    this.playCard(cardId);
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

    if (state.currentPhase === GamePhase.COMBAT && state.combatStep !== 'ATTACKERS') {
      this.notificationService.showToast('Acción inválida', 'Aún no puedes declarar atacantes. Espera al paso correspondiente.', 'WARNING');
      return;
    }

    const isCreature = (card.type || '').toLowerCase().includes('creature') || (card.type || '').toLowerCase().includes('criatura');
    if (!isCreature) {
      this.notificationService.showToast('Acción inválida', 'Solo las criaturas pueden atacar.', 'INFO');
      return;
    }

    if (card.isTapped && !card.isAttacking) {
      this.notificationService.showToast('Acción inválida', 'Una criatura girada no puede atacar.', 'INFO');
      return;
    }

    if (this.hasAbility(card, 'defender') || this.hasAbility(card, 'defensor')) {
      this.notificationService.showToast('Acción inválida', 'Las criaturas con Defender no pueden atacar.', 'WARNING');
      return;
    }

    const cardName = (card.name || '').toLowerCase();
    const pState = this.me();
    if (pState && cardName.includes('hazoret')) {
      const isMaxSpeed = pState.speed && pState.speed >= 4;
      if (!isMaxSpeed) {
        this.notificationService.showToast('Velocidad máxima requerida', 'Hazoret no puede atacar/ bloquear sin velocidad máxima.', 'WARNING');
        return;
      }
    }

    // Summoning Sickness check
    const hasHaste = this.hasAbility(card, 'haste') || this.hasAbility(card, 'prisa');
    if (card.enteredFieldTurn === state.turnCount && !hasHaste) {
      this.notificationService.showToast('Mareo de invocación', 'Esta criatura acaba de llegar, no puede atacar todavía.', 'WARNING');
      return;
    }

    this.isProcessing = true;
    const p = this.me();
    if (card.isAttacking) {
      card.isAttacking = false;
      const hasVigilance = this.hasAbility(card, 'vigilance') || this.hasAbility(card, 'vigilancia');
      if (!hasVigilance) card.isTapped = false;
      this.addLogEntry(`${p?.username || ''} retira atacante: ${card.name}.`);
    } else {
      card.isAttacking = true;
      const hasVigilance = this.hasAbility(card, 'vigilance') || this.hasAbility(card, 'vigilancia');
      if (!hasVigilance) card.isTapped = true;
      this.addLogEntry(`${p?.username || ''} ataca con: ${card.name}.`);
      const pState = this.me();
      if (pState && !(pState as any)._dyadrineTriggeredThisCombat) {
        const dyadrine = pState.field.find(c => (c.name || '').toLowerCase().includes('dyadrine') && (c.oracleText || '').toLowerCase().includes('remove a +1/+1 counter from each of two creatures'));
        if (dyadrine) {
          (pState as any)._dyadrineTriggeredThisCombat = true;
          const targetsWithCounters = pState.field.filter(c => c.counters && c.counters['+1/+1'] && c.counters['+1/+1'] > 0 && (c.type || '').toLowerCase().includes('creature'));
          if (targetsWithCounters.length >= 2) {
            (state as any)._pendingDyadrineChoice = {
              creatures: targetsWithCounters.slice(0, 2).map(c => ({ id: c.id, name: c.name, counters: c.counters!['+1/+1'] })),
            };
            this.notificationService.showToast('Dyadrine', '¿Activar habilidad al atacar?', 'INFO');
            this.isProcessing = false;
            this.gameStateSubject.next({ ...state });
            return;
          }
        }
      }

      if (pState && (card.oracleText || '').toLowerCase().includes('whenever this vehicle enters or attacks')) {
        const basicLands = pState.library.filter(lc => {
          const lt = (lc.type || '').toLowerCase();
          return lt.includes('basic') || ['Forest','Plains','Island','Swamp','Mountain','Bosque','Llanura','Isla','Pantano','Montaña'].includes(lc.name);
        });
        if (basicLands.length > 0) {
          const chosenLand = basicLands[0];
          const li = pState.library.indexOf(chosenLand);
          if (li !== -1) pState.library.splice(li, 1);
          chosenLand.isTapped = true;
          pState.field.push(chosenLand);
          pState.libraryCount = pState.library.length;
          this.addLogEntry(`${pState.username} busca ${chosenLand.name} al atacar con ${card.name}.`);
        }
      }
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

      if (this.hasProtectionFromSource(selectedBlocker, opponentAttacker)) {
        this.notificationService.showToast('No puede bloquear', `${selectedBlocker.name} tiene Protección contra ${opponentAttacker.name}.`, 'WARNING');
        this.isProcessing = false;
        return;
      }

      selectedBlocker.blockingTargetId = opponentAttacker.id;
      selectedBlocker.isBlocking = false;
      this.addLogEntry(`${selectedBlocker.name} bloquea a ${opponentAttacker.name}.`);
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
    if (a === 'defender' || a === 'defensor') return text.includes('defender') || text.includes('defensor');
    if (a === 'hexproof' || a === 'resguardo') return text.includes('hexproof') || text.includes('resguardo');
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

    const otLower = (card.oracleText || '').toLowerCase();
    const isSacLand = (card.type || '').toLowerCase().includes('land') &&
      (otLower.includes('sacrifice this land') || otLower.includes('sacrificar esta tierra'));
    if (isSacLand) {
      this.notificationService.showToast('Sin maná', 'Esta tierra no produce maná directamente. Usa su habilidad.', 'INFO');
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    
    let produced = card.producedMana || [];
    if (produced.length === 0) {
      const manaMatches = [...otLower.matchAll(/(?:\{t}\s*:\s*)(?:add|añade)\s+\{(\w)\}/gi)];
      if (manaMatches.length > 0) {
        produced = manaMatches.map(m => `{${m[1].toUpperCase()}}`);
        produced = [...new Set(produced)];
      }
      const orMatches = [...otLower.matchAll(/(?:\{t}\s*:\s*)(?:add|añade)\s+\{(?:\w)\}\s+(?:or|o)\s+\{(\w)\}/gi)];
      for (const m of orMatches) {
        produced.push(`{${m[1].toUpperCase()}}`);
      }
      produced = [...new Set(produced)];
      if (produced.length === 0 && (otLower.includes('add one mana of any color') || otLower.includes('añade un maná de cualquier color'))) {
        produced = ['{W}', '{U}', '{B}', '{R}', '{G}'];
      }
    }
    const manaTypeSingle = produced.length === 1 ? this.mapColorToPoolKey(produced[0]) : this.getManaType(card);
    const canProduce = produced.length > 1 || manaTypeSingle !== null;

    if (!canProduce) {
      this.notificationService.showToast('Sin maná', 'Esta carta no produce maná.', 'INFO');
      this.isProcessing = false;
      return;
    }

    card.isTapped = true;

    const otMana = (card.oracleText || '').toLowerCase();
    if (otMana.includes('activate only if you control') || otMana.includes('activa esto solo si controlas')) {
      const hasForest = p.field.some(fc => {
        const fn = (fc.name || '').toLowerCase();
        const ft = (fc.type || '').toLowerCase();
        return fn.includes('forest') || fn.includes('bosque') || ft.includes('forest');
      });
      const hasPlains = p.field.some(fc => {
        const fn = (fc.name || '').toLowerCase();
        const ft = (fc.type || '').toLowerCase();
        return fn.includes('plains') || fn.includes('llanura') || ft.includes('plains');
      });
      const canGetWhite = hasForest || hasPlains;
      produced = produced.filter(m => {
        if (m === '{W}' || m === 'W') return canGetWhite;
        return true;
      });
    }
    if (produced.length > 1) {
      state.pendingManaChoice = {
        playerId: p.id,
        cardId: card.id,
        options: produced
      };
      this.gameStateSubject.next({ ...state });
      this.updateState({}, true);
    } else {
      const finalManaType = produced.length === 1 ? this.mapColorToPoolKey(produced[0]) : manaTypeSingle;
      if (finalManaType) {
        (p.manaPool as any)[finalManaType]++;
      }

      const extraManaCreatures = p.field.filter(c =>
        (c.oracleText || '').toLowerCase().includes('siempre que gires una criatura para obtener maná') ||
        (c.oracleText || '').toLowerCase().includes('whenever you tap a creature for mana')
      );
      if (!isLand && extraManaCreatures.length > 0) {
        p.manaPool.green = (p.manaPool.green || 0) + 1;
        this.addLogEntry(`+{G} adicional por girar criatura para maná.`);
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
      
      newState = this.checkStateBasedActions(newState);
      newState = this.checkGameOver(newState);
      const gameEnded = !!newState.winnerId;

      this.gameStateSubject.next(newState);
      if (gameEnded && newState.winnerId !== 'DRAW') {
        this.battleService.pushState(newState.matchId, newState).subscribe({
          next: () => this.battleService.finishMatch(newState.matchId, newState.winnerId!).subscribe({
            next: (res) => { this.lastMatchResult = res; const s = this.gameStateSubject.value; if (s) { (s as any)._lastMatchResult = res; this.gameStateSubject.next(s); } if (onComplete) onComplete(); },
            error: () => { if (onComplete) onComplete(); }
          }),
          error: () => { if (onComplete) onComplete(); }
        });
      } else if (sync) {
        this.battleService.pushState(newState.matchId, newState).subscribe({
          next: () => {
            (newState as any)._syncFailed = false;
            this.gameStateSubject.next({ ...this.gameStateSubject.value, _syncFailed: false } as any);
            if (onComplete) onComplete();
          },
          error: (err) => { 
            (newState as any)._syncFailed = true;
            const s = this.gameStateSubject.value; if (s) { (s as any)._syncFailed = true; this.gameStateSubject.next(s); }
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

  private checkStateBasedActions(state: GameState): GameState {
    if (state.winnerId) return state;

    if ((state.player1.poisonCounters || 0) >= 10) {
      state.winnerId = state.player2.id;
      return state;
    }
    if ((state.player2.poisonCounters || 0) >= 10) {
      state.winnerId = state.player1.id;
      return state;
    }

    for (const p of [state.player1, state.player2]) {
      const toGrave: string[] = [];
      for (const card of p.field) {
        const isCreature = (card.type || '').toLowerCase().includes('creature') || (card.type || '').toLowerCase().includes('criatura');
        if (isCreature) {
          const toughness = this.getModifiedToughness(card, p);
          if (toughness <= 0 || (card.damageTaken || 0) >= toughness) {
            toGrave.push(card.id);
          }
        }
        if (card.attachedToCardId) {
          const attachedStillHere = [...state.player1.field, ...state.player2.field].some(c => c.id === card.attachedToCardId);
          if (!attachedStillHere) {
            toGrave.push(card.id);
          }
        }
      }
      for (const id of toGrave) {
        this.moveToGraveyard(id, p.id);
      }
    }
    return state;
  }

  handleConcede(): void {
    if (this.isConceding) return;
    const state = this.gameStateSubject.value;
    if (!state || state.winnerId) return;

    const me = this.me();
    const opp = this.opponent();
    if (!me || !opp) return;

    this.isConceding = true;
    this.addLogEntry(`${me.username} ha concedido la partida.`);
    this.notificationService.showToast('¡Partida terminada!', `${opp.username} gana por concesión.`, 'SUCCESS');
    this.gameStateSubject.next({ ...state, winnerId: opp.id });

    this.battleService.pushState(state.matchId, { ...state, winnerId: opp.id } as any).subscribe({
      next: () => this.battleService.finishMatch(state.matchId, opp.id).subscribe({
        next: (res) => {
          if (res) {
            this.lastMatchResult = res;
            const s = this.gameStateSubject.value;
            if (s) { (s as any)._lastMatchResult = res; this.gameStateSubject.next(s); }
          }
        },
        error: () => {}
      }),
      error: () => {}
    });
  }

  private refreshVariablePowers(): void {
    const state = this.gameStateSubject.value;
    if (!state) return;
    [state.player1, state.player2].forEach(player => {
      const landCount = player.field.filter(c =>
        (c.type || '').toLowerCase().includes('land') || (c.type || '').toLowerCase().includes('tierra')
      ).length;
      const oppId = player.id === state.player1.id ? state.player2.id : state.player1.id;
      const opp = oppId === state.player1.id ? state.player1 : state.player2;

      player.field.forEach(c => {
        const cName = (c.name || '').toLowerCase();
        if (cName.includes('keen-eyed') || cName.includes('conservador')) {
          const exiledIds = (c as any).exiledCardIds || [];
          const types = new Set<string>();
          for (const eid of exiledIds) {
            const exCard = [...state.player1.exile, ...state.player2.exile].find(ec => ec.id === eid);
            if (exCard) {
              const t = (exCard.type || '').toLowerCase();
              if (t.includes('creature') || t.includes('criatura')) types.add('creature');
              else if (t.includes('instant') || t.includes('instantáneo')) types.add('instant');
              else if (t.includes('sorcery') || t.includes('conjuro')) types.add('sorcery');
              else if (t.includes('artifact') || t.includes('artefacto')) types.add('artifact');
              else if (t.includes('enchantment') || t.includes('encantamiento')) types.add('enchantment');
              else if (t.includes('land') || t.includes('tierra')) types.add('land');
              else if (t.includes('planeswalker')) types.add('planeswalker');
              else if (t.includes('battle')) types.add('battle');
            }
          }
          const hadBuff = (c as any)._curatorBuff;
          const shouldBuff = types.size >= 4;
          if (shouldBuff && !hadBuff) {
            c.tempPowerModifier = (c.tempPowerModifier || 0) + 4;
            c.tempToughnessModifier = (c.tempToughnessModifier || 0) + 4;
            const existing = (c as any).grantedAbilities || [];
            if (!existing.includes('trample')) { existing.push('trample'); (c as any).grantedAbilities = existing; c.oracleText = (c.oracleText || '') + ', trample'; }
            (c as any)._curatorBuff = true;
          } else if (!shouldBuff && hadBuff) {
            c.tempPowerModifier = (c.tempPowerModifier || 0) - 4;
            c.tempToughnessModifier = (c.tempToughnessModifier || 0) - 4;
            (c as any)._curatorBuff = false;
          }
        }
      });
      const anyBlackPerm = [...player.field, ...opp.field].some(c => {
        const mc = c.manaCost || [];
        return mc.some((m: string) => m.toUpperCase() === 'B' || m === '{B}');
      });
      player.field.forEach(c => {
        if ((c.power || '').trim() === '*') {
          // Power = land count, calculated in getModifiedPower
        }
        if (c.name.toLowerCase().includes('knight of grace') || c.name.toLowerCase().includes('caballero de la gracia')) {
          if (!c.counters) c.counters = {};
          const shouldHave = anyBlackPerm ? 1 : 0;
          if (shouldHave > 0 && !(c as any)._knightBuff) {
            c.tempPowerModifier = (c.tempPowerModifier || 0) + 1;
            (c as any)._knightBuff = true;
          } else if (shouldHave === 0 && (c as any)._knightBuff) {
            c.tempPowerModifier = (c.tempPowerModifier || 0) - 1;
            (c as any)._knightBuff = false;
          }
        }
      });
    });
  }

  private triggerLandfall(p: PlayerGameState, state: GameState): void {
    p.field.forEach(card => {
      const ot = (card.oracleText || '').toLowerCase();
      if (!ot.includes('landfall') && !ot.includes('aterrizaje')) return;

      this.addLogEntry(`Landfall — ${card.name} se activa.`);
      this.pushAnimation({ cardId: card.id, type: 'landfall', duration: 1200, message: card.name });

      if (ot.includes('pon un contador +1/+1') || ot.includes('put a +1/+1 counter')) {
        if (!card.counters) card.counters = {};
        card.counters['+1/+1'] = (card.counters['+1/+1'] || 0) + 1;
        this.addLogEntry(`${card.name} recibe un contador +1/+1.`);
      }

      else if ((ot.includes('duplica') || ot.includes('double')) && (ot.includes('contador') || ot.includes('counter'))) {
        if (!card.counters) card.counters = {};
        const current = card.counters['+1/+1'] || 0;
        card.counters['+1/+1'] = current * 2;
        this.addLogEntry(`${card.name} duplica contadores +1/+1 (${current} → ${card.counters['+1/+1']}).`);
      }

      else if (ot.includes('mill')) {
        const milled = p.library.shift();
        if (milled) {
          p.graveyard.push(milled);
          p.libraryCount = p.library.length;
          p.graveyardCount = p.graveyard.length;
          this.addLogEntry(`${p.username} hace mill de ${milled.name}.`);
        }
      }

      else if (ot.includes('duplica la fuerza') || ot.includes('double the power')) {
        state.pendingTarget = {
          sourceCardId: card.id,
          validTargets: 'MY_CREATURE',
          effect: 'LANDFALL_DOUBLE_POWER',
          value: 0
        };
        this.notificationService.showToast('Landfall', 'Selecciona una criatura tuya para duplicar su fuerza.', 'INFO');
        this.isProcessing = false;
        (card as any)._pendingLandfallDouble = true;
        return;
      }

      else if (ot.includes('contador de búsqueda') || ot.includes('quest counter')) {
        if (!card.counters) card.counters = {};
        card.counters['quest'] = (card.counters['quest'] || 0) + 1;
        this.addLogEntry(`${card.name} recibe contador de búsqueda (${card.counters['quest']}).`);
        if (card.counters['quest'] >= 4) {
          const targetCreature = p.field.find(c => c.id !== card.id && ((c.type || '').toLowerCase().includes('creature') || (c.type || '').toLowerCase().includes('criatura')));
          if (targetCreature) {
            if (!targetCreature.counters) targetCreature.counters = {};
            targetCreature.counters['+1/+1'] = (targetCreature.counters['+1/+1'] || 0) + 1;
            const existing = (targetCreature as any).grantedAbilities || [];
            if (!existing.includes('trample')) { existing.push('trample'); (targetCreature as any).grantedAbilities = existing; targetCreature.oracleText = (targetCreature.oracleText || '') + ', trample'; }
            this.addLogEntry(`${targetCreature.name}: +1/+1 y arrollar por ${card.name}.`);
          }
        }
      }
    });
  }

  private createToken(p: PlayerGameState, name: string, type: string, oracleText: string): GameCard {
    const token: GameCard = {
      id: 'token_' + Math.random().toString(36).substr(2, 9),
      name,
      imageUrl: '',
      isTapped: false,
      type,
      oracleText,
      manaCost: [],
      isToken: true,
      enteredFieldTurn: -1,
      power: type.toLowerCase().includes('creature') ? '1' : undefined as any,
      toughness: type.toLowerCase().includes('creature') ? '1' : undefined as any,
      counters: {},
      hasSummoningSickness: true
    };
    this.pushAnimation({ cardId: token.id, type: 'token_create', duration: 800, message: name });
    p.field.push(token);
    p.field = [...p.field];
    this.addLogEntry(`${p.username} crea ficha: ${name}.`);
    return token;
  }

  private executeDeathTrigger(card: GameCard, p: PlayerGameState, state: GameState): void {
    const ot = (card.oracleText || '').toLowerCase();

    this.pushAnimation({ cardId: card.id, type: 'death', duration: 1000, message: card.name });

    if (ot.includes('deals 1 damage to you') || ot.includes('hace 1 punto de daño')) {
      p.hp -= 1;
      this.addLogEntry(`${card.name} hace 1 de daño a ${p.username}.`);
    }

    if (ot.includes('create a clue') || ot.includes('crea una ficha de pista')) {
      const clue: GameCard = {
        id: 'token_' + Math.random().toString(36).substr(2, 9),
        name: 'Clue Token',
        imageUrl: '',
        isTapped: false,
        type: 'Artifact — Clue',
        oracleText: '{2}, Sacrifice this artifact: Draw a card.',
        manaCost: [],
        isToken: true,
        enteredFieldTurn: -1,
        power: undefined,
        toughness: undefined
      };
      p.field.push(clue);
      this.addLogEntry(`${p.username} crea una ficha de Pista.`);
    }

    if (ot.includes('exile the top card') || ot.includes('exilia la primera carta')) {
      const topCard = p.library.shift();
      if (topCard) {
        p.exile.push(topCard);
        p.exileCount = p.exile.length;
        p.libraryCount = p.library.length;
        (topCard as any).playableUntilEndOfNextTurn = true;
        this.addLogEntry(`${p.username} exilia ${topCard.name} del lbrary.`);
      }
    }
  }

  private pushAnimation(event: Omit<AnimationEvent, 'id'>): void {
    const state = this.gameStateSubject.value;
    if (!state) return;
    if (!state.animationEvents) state.animationEvents = [];
    state.animationEvents.push({ ...event, id: 'anim_' + Math.random().toString(36).substr(2, 9) });
    if (state.animationEvents.length > 50) {
      state.animationEvents = state.animationEvents.slice(-30);
    }
  }

  private checkSpeedIncrease(state: GameState, damagedPlayerId: string): void {
    if (!state.player1.speed && !state.player2.speed) return;
    [state.player1, state.player2].forEach(player => {
      if (player.speed && player.speed < 4 && !player.dealtDamageThisTurn && player.id !== damagedPlayerId) {
        player.speed++;
        player.dealtDamageThisTurn = true;
        if (player.speed >= 4) player.maxSpeedReached = true;
        this.addLogEntry(`Velocidad aumenta a ${player.speed}.`);
        this.pushAnimation({ cardId: player.id, type: 'speed_up', duration: 1000, message: `Speed ${player.speed}` });
      }
    });
  }

  private addLogEntry(msg: string): void {
    const state = this.gameStateSubject.value;
    if (!state) return;
    if (!state.actionLog) state.actionLog = [];
    const entry = `[T${state.turnCount}] ${msg}`;
    state.actionLog.push(entry);
    if (state.actionLog.length > 100) state.actionLog.shift();
  }

  private checkGameOver(state: GameState): GameState {
    if (state.winnerId) return state;

    if (state.player1.hp <= 0 && state.player2.hp <= 0) {
      state.winnerId = 'DRAW';
      this.addLogEntry('¡Empate! Ambos jugadores han caído.');
    } else if (state.player1.hp <= 0) {
      state.winnerId = state.player2.id;
      this.addLogEntry(`${state.player2.username} gana (HP de ${state.player1.username} llega a 0).`);
    } else if (state.player2.hp <= 0) {
      state.winnerId = state.player1.id;
      this.addLogEntry(`${state.player1.username} gana (HP de ${state.player2.username} llega a 0).`);
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
      
      const hasFS = this.hasAbility(attacker, 'first strike') || this.hasAbility(attacker, 'dañar primero');
      const hasDS = this.hasAbility(attacker, 'double strike') || this.hasAbility(attacker, 'dañar dos veces');
      
      if (!(hasFS || hasDS)) return;

      if (blockers.length > 0) {
        const blockersWithFS = blockers.filter(b =>
          this.hasAbility(b, 'first strike') || this.hasAbility(b, 'dañar primero') ||
          this.hasAbility(b, 'double strike') || this.hasAbility(b, 'dañar dos veces')
        );
        const blockersWithoutFS = blockers.filter(b =>
          !(this.hasAbility(b, 'first strike') || this.hasAbility(b, 'dañar primero') ||
            this.hasAbility(b, 'double strike') || this.hasAbility(b, 'dañar dos veces'))
        );

        if (blockersWithoutFS.length > 0) {
          this.fightSequential(attacker, blockersWithoutFS, activePlayer, defendingPlayer, false, true, false);
        }
        if (blockersWithFS.length > 0) {
          this.fightSequential(attacker, blockersWithFS, activePlayer, defendingPlayer, false, false, false);
        }
      } else {
        defendingPlayer.hp -= this.getModifiedPower(attacker, activePlayer);
        this.checkSpeedIncrease(state, defendingPlayer.id);
      }
    });

    // 3. NORMAL DAMAGE STEP
    attackers.forEach(attacker => {
      const attackerStillAlive = activePlayer.field.find(c => c.id === attacker.id);
      if (!attackerStillAlive) return;

      const hasFS = this.hasAbility(attacker, 'first strike') || this.hasAbility(attacker, 'dañar primero');
      const hasDS = this.hasAbility(attacker, 'double strike') || this.hasAbility(attacker, 'dañar dos veces');
      if (hasFS && !hasDS) return;

      const blockers = defendingPlayer.field.filter(c => c.blockingTargetId === attacker.id);
      if (blockers.length === 0) {
        defendingPlayer.hp -= this.getModifiedPower(attacker, activePlayer);
        this.checkSpeedIncrease(state, defendingPlayer.id);
      } else {
        const blockersWithoutFS = blockers.filter(b =>
          !(this.hasAbility(b, 'first strike') || this.hasAbility(b, 'dañar primero'))
        );

        let hasTrample = this.hasAbility(attacker, 'trample') || this.hasAbility(attacker, 'arrollar');

        if (hasDS) {
          this.fightSequential(attacker, blockers, activePlayer, defendingPlayer, hasTrample, true, false);
        }
        if (blockersWithoutFS.length > 0) {
          this.fightSequential(attacker, blockersWithoutFS, activePlayer, defendingPlayer, hasTrample, false, false);
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
    (activePlayer as any)._dyadrineTriggeredThisCombat = false;

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
        const excess = ap - bt;
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
    if ((card.power || '').trim() === '*') {
      const landCount = player.field.filter(c =>
        (c.type || '').toLowerCase().includes('land') || (c.type || '').toLowerCase().includes('tierra')
      ).length;
      return landCount;
    }
    let p = parseInt(card.power || '0');
    p += (card.tempPowerModifier || 0);
    const c = (card as any).counters;
    const cTotal = c && typeof c === 'object' ? Object.values(c as Record<string, number>).reduce((a, b) => a + b, 0) : (typeof c === 'number' ? c : 0);
    p += cTotal;

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
    const counters = (card as any).counters;
    const counterTotal = counters && typeof counters === 'object' ? Object.values(counters as Record<string, number>).reduce((a, b) => a + b, 0) : (typeof counters === 'number' ? counters : 0);
    t += counterTotal;

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
      card.damageTaken = 0;
      
      if (card.isAnimated) {
        card.isAnimated = false;
        card.isTapped = true;
        card.power = undefined as any;
        card.toughness = undefined as any;
        card.counters = {};
        card.hasSummoningSickness = true;
        if (card.originalLandType) {
          card.type = card.originalLandType;
          card.originalLandType = undefined;
        }
        p.field.push(card);
        p.field = [...p.field];
        this.addLogEntry(`Tierra animada ${card.name} vuelve al campo girada.`);
      } else {
        const ot = (card.oracleText || '').toLowerCase();

        if (ot.includes('when this creature dies') || ot.includes('cuando esta criatura muera')) {
          this.addLogEntry(`Trigger al morir: ${card.name}.`);
          this.executeDeathTrigger(card, p, state);
        }

        p.graveyard.push(card);
        p.graveyardCount = p.graveyard.length;
        p.field = [...p.field];
        console.log(`🪦 Carta ${card.name} movida al cementerio de ${p.username}.`);
      }
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

  private fightSequential(attacker: GameCard, blockers: GameCard[], activePlayer: PlayerGameState, defendingPlayer: PlayerGameState, hasTrample: boolean = false, attackerOnly: boolean = false, blockerOnly: boolean = false): void {
    let remainingAttackerDamage = attackerOnly ? 0 : this.getModifiedPower(attacker, activePlayer);
    const order = (attacker as any).orderedBlockers || blockers.map(b => b.id);
    
    const sortedBlockers = [...blockers].sort((a, b) => {
      const idxA = order.indexOf(a.id);
      const idxB = order.indexOf(b.id);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });

    sortedBlockers.forEach(blocker => {
      const blockerPower = this.getModifiedPower(blocker, defendingPlayer);
      const blockerToughness = this.getModifiedToughness(blocker, defendingPlayer);
      const remainingBlockerToughness = Math.max(0, blockerToughness - (blocker.damageTaken || 0));

      if (!blockerOnly && remainingAttackerDamage > 0) {
        const damageToAssign = Math.min(remainingAttackerDamage, remainingBlockerToughness);
        const isLast = blocker === sortedBlockers[sortedBlockers.length - 1];
        const finalDamage = (isLast && !hasTrample) ? remainingAttackerDamage : damageToAssign;
        const preventedDmg = this.applyCombatDamageWithPrevention(blocker, finalDamage);

        blocker.damageTaken = (blocker.damageTaken || 0) + preventedDmg;
        remainingAttackerDamage -= finalDamage;

        if (this.hasAbility(attacker, 'lifelink') || this.hasAbility(attacker, 'vínculo vital')) {
          activePlayer.hp += preventedDmg;
        }
        
        if (blocker.damageTaken >= blockerToughness) {
          this.addLogEntry(`${blocker.name} muere en combate.`);
          this.moveToGraveyard(blocker.id, defendingPlayer.id);
        }
      }

      if (!attackerOnly) {
        const attackerToughness = this.getModifiedToughness(attacker, activePlayer);
        const preventedBlockerDmg = this.applyCombatDamageWithPrevention(attacker, blockerPower);
        attacker.damageTaken = (attacker.damageTaken || 0) + preventedBlockerDmg;

        if (this.hasAbility(blocker, 'lifelink') || this.hasAbility(blocker, 'vínculo vital')) {
          defendingPlayer.hp += preventedBlockerDmg;
        }
        
        if (attacker.damageTaken >= attackerToughness) {
          this.moveToGraveyard(attacker.id, activePlayer.id);
        }
      }
    });

    if (!blockerOnly && hasTrample && remainingAttackerDamage > 0) {
      defendingPlayer.hp -= remainingAttackerDamage;
    }
  }

  private applyCombatDamageWithPrevention(target: GameCard, damage: number): number {
    const prevention = (target as any).damagePrevention || 0;
    if (prevention > 0) {
      const prevented = Math.min(prevention, damage);
      (target as any).damagePrevention = prevention - prevented;
      return damage - prevented;
    }
    if (this.hasAbility(target, 'protection') || this.hasAbility(target, 'protección')) {
      return 0;
    }
    return damage;
  }

  private hasProtectionFromSource(card: GameCard, sourceCard?: GameCard): boolean {
    if (!this.hasAbility(card, 'protection') && !this.hasAbility(card, 'protección')) return false;
    const text = (card.oracleText || '').toLowerCase();
    const protMatch = text.match(/protection from (\w+)/);
    if (!protMatch) return true;
    const quality = protMatch[1];
    if (quality === 'everything' || quality === 'todo') return true;
    if (sourceCard) {
      const sourceText = (sourceCard.oracleText || '').toLowerCase();
      const sourceType = (sourceCard.type || '').toLowerCase();
      if (sourceType.includes(quality) || sourceText.includes(quality)) return true;
    }
    return true;
  }

  handleAdventureChoice(cardId: string, castAsAdventure: boolean): void {
    const state = this.gameStateSubject.value;
    if (!state?.pendingAdventureChoice) return;
    const p = this.me();
    if (!p) return;

    const card = p.hand.find(c => c.id === cardId);
    if (card) {
      (card as any).castAsAdventure = castAsAdventure;
      if (castAsAdventure) {
        card.exileOnResolution = true;
      }
    }
    (card as any).advResolved = true;
    state.pendingAdventureChoice = undefined;
    this.isProcessing = false;
    this.playCard(cardId);
  }

  handleMdfcChoice(cardId: string, face: number): void {
    const state = this.gameStateSubject.value;
    if (!state?.pendingMdfcChoice) return;
    const p = this.me();
    if (!p) return;

    const card = p.hand.find(c => c.id === cardId);
    if (card) {
      (card as any).mdfcFaceSelected = face;
    }
    (card as any).mdfcResolved = true;
    state.pendingMdfcChoice = undefined;
    this.isProcessing = false;
    this.playCard(cardId);
  }

  handleForetellAction(cardId: string): void {
    const state = this.gameStateSubject.value;
    if (!state) return;
    const p = this.me();
    if (!p) return;

    const index = p.hand.findIndex(c => c.id === cardId);
    if (index === -1) return;
    const card = p.hand.splice(index, 1)[0];
    card.isForetold = true;
    card.foretellTurn = state.turnCount;
    p.exile.push(card);
    p.exileCount = p.exile.length;
    p.handCount = p.hand.length;
    this.updateState({}, true);
  }

  handlePlotAction(cardId: string): void {
    const state = this.gameStateSubject.value;
    if (!state) return;
    const p = this.me();
    if (!p) return;

    const index = p.hand.findIndex(c => c.id === cardId);
    if (index === -1) return;
    const card = p.hand[index];
    const plotMatch = (card.oracleText || '').toLowerCase().match(/plot\s*((?:\{[^}]+\})+)/i);
    if (!plotMatch) return;
    const plotSymbols = plotMatch[1].match(/\{[^}]+\}/g) || [];
    const costReq = this.parseManaCost(plotSymbols);
    if (!this.canAffordParsed(costReq, p.manaPool)) {
      this.notificationService.showToast('Falta maná', 'No tienes suficiente maná para Plot.', 'WARNING');
      return;
    }
    this.paySpecificCosts(costReq, p.manaPool);
    const remainingGeneric = costReq.generic;
    if (remainingGeneric > 0) {
      const colors: (keyof ManaPool)[] = ['colorless', 'white', 'blue', 'black', 'red', 'green'];
      let paid = 0;
      for (const c of colors) {
        const spend = Math.min(p.manaPool[c] || 0, remainingGeneric - paid);
        if (spend > 0) { p.manaPool[c]! -= spend; paid += spend; }
        if (paid >= remainingGeneric) break;
      }
    }

    const removed = p.hand.splice(index, 1)[0];
    removed.isPlotted = true;
    p.exile.push(removed);
    p.exileCount = p.exile.length;
    p.handCount = p.hand.length;
    this.pushAnimation({ cardId: removed.id, type: 'plot', duration: 1000, message: removed.name });
    this.addLogEntry(`${p.username} hace Plot a ${removed.name}.`);
    this.updateState({}, true);
  }

  handleBestowChoice(cardId: string, castAsBestow: boolean): void {
    const state = this.gameStateSubject.value;
    if (!state) return;
    const p = this.me();
    if (!p) return;

    const card = p.hand.find(c => c.id === cardId);
    if (card) {
      card.castAsBestow = castAsBestow;
      if (castAsBestow) {
        const type = card.type || '';
        card.type = type.includes('enchantment') ? type + ' Aura' : 'Enchantment — Aura';
      }
    }
    this.playCard(cardId);
  }

  handleScrySurveilChoice(playerId: string, orderedCardIds: string[], discardedIds: string[] = []): void {
    const state = this.gameStateSubject.value;
    if (!state?.pendingScrySurveilChoice) return;
    const p = state.player1.id === playerId ? state.player1 : state.player2;

    const isSurveil = state.pendingScrySurveilChoice.type === 'SURVEIL';
    const originalTop = state.pendingScrySurveilChoice.cards;

    const kept = originalTop.filter(c => !discardedIds.includes(c.id));
    const reordered = orderedCardIds.length > 0
      ? orderedCardIds.map(id => kept.find(c => c.id === id)).filter(Boolean) as GameCard[]
      : kept;

    for (const d of originalTop.filter(c => discardedIds.includes(c.id))) {
      p.graveyard.push(d);
      p.graveyardCount = p.graveyard.length;
    }

    const library = p.library.slice(originalTop.length);
    p.library = [...reordered, ...library];
    p.libraryCount = p.library.length;

    state.pendingScrySurveilChoice = undefined;
    this.updateState({}, true);
  }

  handleSacrificeChoice(playerId: string, sacrificedCardId: string): void {
    const state = this.gameStateSubject.value;
    if (!state?.pendingSacrificeChoice) return;
    const p = state.player1.id === playerId ? state.player1 : state.player2;

    this.moveToGraveyard(sacrificedCardId, playerId);
    state.pendingSacrificeChoice = undefined;
    this.updateState({}, true);
  }

  handleCascadeChoice(cardId: string, castIt: boolean): void {
    const state = this.gameStateSubject.value;
    if (!state?.pendingDiscoverChoice) return;

    if (castIt && state.pendingDiscoverChoice.foundCard) {
      const found = state.pendingDiscoverChoice.foundCard;
      found.exileOnResolution = state.pendingDiscoverChoice.isCascade;
      const controller = state.player1.id === state.pendingDiscoverChoice.playerId ? state.player1 : state.player2;
      controller.hand.push(found);
      controller.handCount = controller.hand.length;
    }

    state.pendingDiscoverChoice = undefined;
    this.updateState({}, true);
  }

  handleModalChoice(selectedModeIndices: number[]): void {
    const state = this.gameStateSubject.value;
    if (!state?.pendingModalChoice) return;

    const modes = state.pendingModalChoice.modes;
    const selected = selectedModeIndices.map(i => modes[i]).filter(Boolean);

    this.isProcessing = true;
    const p = this.me();
    if (!p) return;

    for (const modeObj of selected) {
      const modeText = typeof modeObj === 'string' ? modeObj : (modeObj?.text || '');
      const mt = modeText.toLowerCase();
      if (mt.includes('search') || mt.includes('busca')) {
        const basicLands = p.library.filter(c => {
          const type = (c.type || '').toLowerCase();
          return type.includes('basic') || ['Forest','Plains','Island','Swamp','Mountain','Bosque','Llanura','Isla','Pantano','Montaña'].includes(c.name);
        });
        if (basicLands.length > 0) {
          const chosen = basicLands[0];
          const idx = p.library.indexOf(chosen);
          if (idx !== -1) p.library.splice(idx, 1);
          p.hand.push(chosen);
          p.handCount = p.hand.length;
          p.libraryCount = p.library.length;
          this.addLogEntry(`${p.username} busca ${chosen.name} en la biblioteca.`);
        }
      } else if (mt.includes('fight') || mt.includes('lucha')) {
        state.pendingFightChoice = { sourceCardId: state.pendingModalChoice.cardId };
        state.pendingTarget = {
          sourceCardId: state.pendingModalChoice.cardId,
          validTargets: 'MY_CREATURE',
          effect: 'BUFF',
          value: 0
        };
        this.notificationService.showToast('Elige tu criatura', 'Selecciona tu criatura para luchar.', 'INFO');
      }
    }

    state.pendingModalChoice = undefined;
    this.isProcessing = false;
    this.updateState({}, true);
  }

  private executeCascade(player: PlayerGameState, state: GameState, manaValueLimit?: number): void {
    const mvLimit = manaValueLimit !== undefined ? manaValueLimit : 999;
    const revealed: GameCard[] = [];
    let found: GameCard | null = null;

    while (player.library.length > 0) {
      const card = player.library.shift()!;
      revealed.push(card);
      const cmc = this.calcManaValue(card.manaCost || []);
      if (cmc < mvLimit) {
        found = card;
        break;
      }
    }

    state.pendingDiscoverChoice = {
      playerId: player.id,
      cardsRevealed: revealed,
      foundCard: found,
      isCascade: manaValueLimit === undefined,
      manaValueLimit: mvLimit
    };
  }

  private calcManaValue(manaCost: string[]): number {
    let total = 0;
    for (const sym of manaCost) {
      const numMatch = sym.match(/\{(\d+)\}/);
      if (numMatch) {
        total += parseInt(numMatch[1]);
      } else if (sym.match(/\{[WUBRGC]\}/i)) {
        total += 1;
      }
    }
    return total;
  }

  handlePlaneswalkerAction(planeswalkerId: string, abilityIndex: number): void {
    const state = this.gameStateSubject.value;
    if (!state) return;
    const p = this.me();
    if (!p) return;

    const pw = p.field.find(c => c.id === planeswalkerId && (c.isPlaneswalker || c.type?.toLowerCase().includes('planeswalker')));
    if (!pw) return;

    const lines = (pw.oracleText || '').split('\n');
    const abilityLines = lines.filter(l => l.match(/^[+\-−]\d+:/));
    if (abilityIndex < 0 || abilityIndex >= abilityLines.length) return;

    const ability = abilityLines[abilityIndex];
    const loyaltyMatch = ability.match(/^([+\-−])(\d+):/);
    if (!loyaltyMatch) return;

    const sign = loyaltyMatch[1] === '+' ? 1 : -1;
    const amount = parseInt(loyaltyMatch[2]);
    const currentLoyalty = (pw as any).loyalty || 0;
    const newLoyalty = currentLoyalty + (sign * amount);
    (pw as any).loyalty = newLoyalty;

    if (newLoyalty <= 0) {
      this.moveToGraveyard(pw.id, p.id);
    }

    this.updateState({}, true);
  }

  handleCycling(cardId: string): void {
    const state = this.gameStateSubject.value;
    if (!state) return;
    const p = this.me();
    if (!p) return;

    const idx = p.hand.findIndex(c => c.id === cardId);
    if (idx === -1) return;
    const card = p.hand[idx];
    const cyclingMatch = card.oracleText?.toLowerCase().match(/cycling \{(\d+)\}/);
    if (!cyclingMatch) return;

    const cost = parseInt(cyclingMatch[1]);
    const totalMana = Object.values(p.manaPool).reduce((a, b) => a + b, 0);
    if (totalMana < cost) {
      this.notificationService.showToast('Falta maná', 'No tienes suficiente maná para ciclar.', 'WARNING');
      return;
    }

    let remaining = cost;
    for (const color of ['colorless', 'white', 'blue', 'black', 'red', 'green'] as const) {
      const available = p.manaPool[color] || 0;
      const used = Math.min(available, remaining);
      p.manaPool[color] = available - used;
      remaining -= used;
      if (remaining <= 0) break;
    }

    this.pushAnimation({ cardId: card.id, type: 'cycling', duration: 800, message: card.name });
    p.hand.splice(idx, 1);
    p.handCount = p.hand.length;
    p.graveyard.push(card);
    p.graveyardCount = p.graveyard.length;
    this.drawCardToPlayer(p);
    this.addLogEntry(`${p.username} cicla ${card.name}.`);
    this.updateState({}, true);
  }

  handleCrewAction(vehicleId: string, creatureIds: string[]): void {
    const state = this.gameStateSubject.value;
    if (!state) return;
    const p = this.me();
    if (!p) return;

    const vehicle = p.field.find(c => c.id === vehicleId);
    if (!vehicle) return;
    const crewMatch = vehicle.oracleText?.toLowerCase().match(/crew (\d+)/);
    if (!crewMatch) return;

    const requiredPower = parseInt(crewMatch[1]);
    let totalPower = 0;
    const toTap: GameCard[] = [];

    for (const cid of creatureIds) {
      const creature = p.field.find(c => c.id === cid);
      if (creature && !creature.isTapped && (creature.type?.toLowerCase().includes('creature') || creature.type?.toLowerCase().includes('criatura'))) {
        totalPower += this.getModifiedPower(creature, p);
        toTap.push(creature);
      }
    }

    if (totalPower < requiredPower) {
      this.notificationService.showToast('Poder insuficiente', `Necesitas ${requiredPower} de poder. Tienes ${totalPower}.`, 'WARNING');
      return;
    }

    for (const c of toTap) {
      c.isTapped = true;
    }
    (vehicle as any).crewed = true;
    vehicle.isTapped = false;
    this.updateState({}, true);
  }

  handleNinjutsuAction(cardId: string, unblockedAttackerId: string): void {
    const state = this.gameStateSubject.value;
    if (!state) return;
    const p = this.me();
    const opp = this.opponent();
    if (!p || !opp) return;

    const cardIdx = p.hand.findIndex(c => c.id === cardId);
    if (cardIdx === -1) return;
    const card = p.hand[cardIdx];

    const attacker = opp.field.find(c => c.id === unblockedAttackerId && c.isAttacking);
    if (!attacker) return;

    const ninjutsuMatch = card.oracleText?.toLowerCase().match(/ninjutsu \{([^}]+)\}/);
    if (!ninjutsuMatch) return;

    const costStr = ninjutsuMatch[1];
    const costReq = this.parseManaCost([costStr]);
    if (!this.canAffordParsed(costReq, p.manaPool)) {
      this.notificationService.showToast('Falta maná', 'No tienes suficiente maná para Ninjutsu.', 'WARNING');
      return;
    }

    this.paySpecificCosts(costReq, p.manaPool);
    if (costReq.generic > 0) {
      this.autoPayGenericInternal(p.manaPool, costReq.generic);
    }

    p.hand.splice(cardIdx, 1);
    attacker.isAttacking = false;
    p.field.push(card);

    this.returnToHand(attacker.id, opp.id);
    card.isAttacking = true;
    card.isTapped = true;
    card.enteredFieldTurn = state.turnCount;

    p.handCount = p.hand.length;
    this.updateState({}, true);
  }

  handleMorphAction(cardId: string): void {
    const state = this.gameStateSubject.value;
    if (!state) return;
    const p = this.me();
    if (!p) return;

    const idx = p.hand.findIndex(c => c.id === cardId);
    if (idx === -1) return;

    const costStr = '{3}';
    const costReq = this.parseManaCost([costStr]);
    if (!this.canAffordParsed(costReq, p.manaPool)) {
      this.notificationService.showToast('Falta maná', 'No tienes suficiente maná para Morph.', 'WARNING');
      return;
    }

    this.paySpecificCosts(costReq, p.manaPool);
    if (costReq.generic > 0) {
      this.autoPayGenericInternal(p.manaPool, costReq.generic);
    }

    const card = p.hand.splice(idx, 1)[0];
    card.isFaceDown = true;
    card.power = '2';
    card.toughness = '2';
    card.type = 'Creature';
    card.oracleText = '(It\'s a 2/2 creature.)';
    card.enteredFieldTurn = state.turnCount;
    p.field.push(card);
    p.handCount = p.hand.length;

    this.updateState({}, true);
  }

  handleMorphFlip(cardId: string): void {
    const state = this.gameStateSubject.value;
    if (!state) return;
    const p = this.me();
    if (!p) return;

    const cardIdx = p.field.findIndex(c => c.id === cardId && c.isFaceDown);
    if (cardIdx === -1) return;

    const originalData = (p.field[cardIdx] as any).originalCardData;
    if (originalData) {
      const flipped = { ...originalData };
      flipped.isFaceDown = false;
      flipped.enteredFieldTurn = state.turnCount;
      flipped.isTapped = p.field[cardIdx].isTapped;
      flipped.isAttacking = p.field[cardIdx].isAttacking;
      p.field[cardIdx] = flipped;
    }

    this.updateState({}, true);
  }

  handleSpreeChoice(cardId: string, selectedOptionIndices: number[]): void {
    const state = this.gameStateSubject.value;
    if (!state?.pendingSpreeChoice) return;
    const p = this.me();
    if (!p) return;

    const selected = state.pendingSpreeChoice.spreeOptions.filter((_, i) => selectedOptionIndices.includes(i));
    for (const opt of selected) {
      const ot = (opt.text || '').toLowerCase();
      if (ot.includes('damage') || ot.includes('daño')) {
        this.addLogEntry(`Spree: aplicando daño.`);
        this.setPendingTargetForCard(cardId, 'CREATURE', 'DAMAGE', 4);
      } else if (ot.includes('destroy') || ot.includes('destruir')) {
        this.addLogEntry(`Spree: destruyendo objetivo.`);
        this.setPendingTargetForCard(cardId, 'CREATURE', 'DESTROY', 0);
      }
    }

    state.pendingSpreeChoice = undefined;
    this.isProcessing = false;
    this.updateState({}, true);
  }

  handleBargainChoice(cardId: string, sacrificeId: string | null): void {
    const state = this.gameStateSubject.value;
    if (!state?.pendingBargainChoice) return;
    const p = this.me();
    if (!p) return;

    if (sacrificeId === 'auto') {
      const valid = p.field.find(c =>
        c.type?.toLowerCase().includes('artifact') || c.type?.toLowerCase().includes('artefacto') ||
        c.type?.toLowerCase().includes('enchantment') || c.type?.toLowerCase().includes('encantamiento') ||
        (c as any).isToken
      );
      if (valid) {
        this.pushAnimation({ cardId: valid.id, type: 'bargain_sac', duration: 600, message: valid.name });
        this.moveToGraveyard(valid.id, p.id);
        this.addLogEntry(`${p.username} sacrifica ${valid.name} por Bargain.`);
      }
    }

    const xVal = (p.hand.find(c => c.id === cardId) as any)?.xValue || 0;
    const bargained = sacrificeId !== null;
    const damage = bargained ? xVal * 2 : xVal;
    if (damage > 0) {
      this.addLogEntry(`Bargain: ${damage} daño.`);
      this.setPendingTargetForCard(cardId, 'CREATURE', 'DAMAGE', damage);
    }

    state.pendingBargainChoice = undefined;
    this.isProcessing = false;
    this.updateState({}, true);
  }

  handleGiftChoice(cardId: string, giveGift: boolean): void {
    const state = this.gameStateSubject.value;
    if (!state?.pendingGiftChoice) return;
    const opp = this.opponent();
    if (!opp) return;

    if (giveGift) {
      this.addLogEntry(`Regalo entregado al oponente.`);
    }

    const p = this.me();
    if (p) {
      this.setPendingTargetForCard(cardId, 'CREATURE', 'BUFF', giveGift ? 2 : 1);
    }

    state.pendingGiftChoice = undefined;
    this.isProcessing = false;
    this.updateState({}, true);
  }

  private setPendingTargetForCard(sourceCardId: string, validTargets: 'CREATURE' | 'PLAYER', effect: 'DAMAGE' | 'DESTROY' | 'BUFF', value: number): void {
    const state = this.gameStateSubject.value;
    if (!state) return;
    state.pendingTarget = {
      sourceCardId,
      validTargets,
      effect: effect as any,
      value
    };
    this.notificationService.showToast('Selecciona objetivo', 'Elige un objetivo.', 'INFO');
    this.gameStateSubject.next({ ...state });
  }

  handleDyadrineChoice(accept: boolean): void {
    const state = this.gameStateSubject.value;
    if (!state || !(state as any)._pendingDyadrineChoice) return;
    const p = this.me();
    const choice = (state as any)._pendingDyadrineChoice;
    (state as any)._pendingDyadrineChoice = undefined;

    if (accept && p) {
      const creatures = p.field.filter(c => choice.creatures.some((cc: any) => cc.id === c.id));
      creatures.forEach((c: GameCard) => { if (c.counters) c.counters['+1/+1'] = (c.counters['+1/+1'] || 1) - 1; });
      this.drawCardToPlayer(p);
      this.createToken(p, 'Robot Token', 'Artifact Creature — Robot', '');
      this.addLogEntry(`Dyadrine: remueve contadores, roba, crea Robot 2/2.`);
    }
    this.isProcessing = false;
    this.updateState({}, true);
  }

  private advanceDayNightCycle(state: GameState): GameState {
    if (!state.timeCycle || state.timeCycle === 'NONE') return state;
    const spellsCastThisTurn = Object.values(state.spellsCastThisTurn || {}).reduce((a, b) => a + b, 0);
    if (spellsCastThisTurn === 0) {
      state.timeCycle = state.timeCycle === 'DAY' ? 'NIGHT' : 'DAY';
    }
    return state;
  }
}
