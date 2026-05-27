import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { BattleService } from '../../../core/services/battle.service';
import { BattleEngineService } from '../../../core/services/battle-engine.service';
import { GameState, GamePhase } from '../../../models/game.model';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { Subscription } from 'rxjs';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-battleboard',
  standalone: true,
  imports: [CommonModule, AvatarComponent],
  templateUrl: './battleboard.component.html',
  styleUrls: ['./battleboard.component.scss']
})
export class BattleboardComponent implements OnInit, OnDestroy {
  gameState: GameState | null = null;
  private subscription: Subscription | null = null;
  protected readonly Math = Math;
  showLog = false;
  showExile = false;
  showOpponentExile = false;
  showGrave = false;
  localWinnerId: string | null = null;
  matchId: string | null = null;
  me: any = null;
  opponent: any = null;
  hoveredCard: any = null;
  
  // Animation states
  private prevDamageMap = new Map<string, number>();
  private prevFieldIds = new Set<string>();
  private processedAnimEvents = new Set<string>();
  hittingCards = new Set<string>();
  dyingCards: any[] = [];
  animatingCards = new Map<string, string>();
  lastDamageTaken = new Map<string, number>();

  onHoverCard(card: any): void {
    this.hoveredCard = card;
  }

  onClearHover(): void {
    this.hoveredCard = null;
  }

  getLands(cards: any[]): any[] {
    return cards?.filter(c => {
      const type = (c.type || '').toLowerCase();
      const name = (c.name || '').toLowerCase();
      // Bolder land detection
      return type.includes('land') || type.includes('tierra') || name.includes('tierra') || 
             name.includes('isla') || name.includes('pantano') || name.includes('montaña') || 
             name.includes('bosque') || name.includes('llanura') || name.includes('templo');
    }) || [];
  }

  getNonLands(cards: any[]): any[] {
    const lands = this.getLands(cards);
    return cards?.filter(c => {
      if (lands.find(l => l.id === c.id)) {
        const isAnim = (c.isAnimated) || ((c.type || '').toLowerCase().includes('creature') && (c.type || '').toLowerCase().includes('land'));
        if (isAnim) return true;
        return false;
      }
      return true;
    }) || [];
  }

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly battleService: BattleService,
    public readonly engine: BattleEngineService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.matchId = this.route.snapshot.paramMap.get('id');
    if (this.matchId) {
      this.battleService.getBattleState(this.matchId).subscribe({
        next: (initialState) => {
          this.engine.initialize(initialState);
          this.subscription = this.engine.gameState$.subscribe(state => {
            this.gameState = state;
            this.me = this.engine.me();
            this.opponent = this.engine.opponent();
            
            if (state?.winnerId && !this.localWinnerId) {
              this.localWinnerId = state.winnerId;
            }
            
            if (state?.pendingBlockerOrders?.length && (state.pendingBlockerOrders[0] as any).currentSelection) {
               this.selectedBlockerIds = [...(state.pendingBlockerOrders[0] as any).currentSelection];
            }
            
            this.processStateChanges(state);
            this.cdr.detectChanges();
          });
          this.engine.startGame();
        }
      });
    }
  }

  onPassPriority(): void {
    this.engine.passPriority();
  }

  onPlayCard(cardId: string): void {
    this.onClearHover();
    const me = this.engine.me();
    if (this.gameState?.currentPhase === GamePhase.MULLIGAN || (me && (me as any)._dropping)) {
      this.engine.dropCardToBottom(cardId);
    } else if (this.gameState?.currentPhase === GamePhase.END && me && me.hand.length > 7) {
      this.engine.discardCard(cardId);
    } else {
      this.engine.playCard(cardId);
    }
  }

  onMulligan(): void {
    this.engine.takeMulligan();
  }

  onKeep(): void {
    this.engine.keepHand();
  }

  onTapCard(cardId: string): void {
    this.engine.tapCard(cardId);
  }

  ngOnDestroy(): void {
    this.engine.stopPolling();
    this.subscription?.unsubscribe();
  }

  onConcede(): void {
    this.engine.handleConcede();
  }

  toggleLog(): void {
    this.showLog = !this.showLog;
  }

  get actionLog(): string[] {
    return this.gameState?.actionLog || [];
  }

  getColorCode(color: string): string {
    const map: any = { W: '#fcd34d', U: '#3b82f6', B: '#a855f7', R: '#ef4444', G: '#22c55e', C: '#94a3b8' };
    return map[color.toUpperCase()] || '#94a3b8';
  }

  getColorIcon(color: string): string {
    const map: any = { W: 'sunny', U: 'water_drop', B: 'skull', R: 'local_fire_department', G: 'forest', C: 'blur_on' };
    return map[color.toUpperCase()] || 'help';
  }

  selectedBlockerIds: string[] = [];

  getCardById(id: string): any {
    return this.opponent.field.find((c: any) => c.id === id) || this.me.field.find((c: any) => c.id === id);
  }

  isBlockerSelected(id: string): boolean {
    return this.selectedBlockerIds.includes(id);
  }

  getBlockerSelectionIndex(id: string): number {
    return this.selectedBlockerIds.indexOf(id) + 1;
  }

  toggleBlockerOrderSelection(id: string): void {
    if (this.gameState?.activePlayerId !== this.me?.id) return;

    const index = this.selectedBlockerIds.indexOf(id);
    if (index !== -1) {
      this.selectedBlockerIds.splice(index, 1);
    } else {
      this.selectedBlockerIds.push(id);
    }
    
    // Sync live selection so the opponent sees it
    if (this.gameState?.pendingBlockerOrders?.length) {
      const orders = [...this.gameState.pendingBlockerOrders];
      (orders[0] as any).currentSelection = [...this.selectedBlockerIds];
      this.engine.updateState({ pendingBlockerOrders: orders }, true);
    }
  }

  isBlockerOrderComplete(): boolean {
    if (!this.gameState?.pendingBlockerOrders || this.gameState.pendingBlockerOrders.length === 0) return false;
    return this.selectedBlockerIds.length === this.gameState.pendingBlockerOrders[0].blockerIds.length;
  }

  submitBlockerOrder(): void {
    if (!this.gameState?.pendingBlockerOrders || this.gameState.pendingBlockerOrders.length === 0) return;
    const attackerId = this.gameState.pendingBlockerOrders[0].attackerId;
    this.engine.confirmBlockerOrder(attackerId, this.selectedBlockerIds);
    this.selectedBlockerIds = [];
  }

  getColorName(color: string): string {
    const map: any = { W: 'Blanco', U: 'Azul', B: 'Negro', R: 'Rojo', G: 'Verde', C: 'Incoloro' };
    return map[color.toUpperCase()] || 'Desconocido';
  }

  getRemainingToughness(card: any, player: any): string {
    const t = this.engine.getModifiedToughness(card, player);
    const d = typeof card.damageTaken === 'number' ? card.damageTaken : 0;
    return String(t - d);
  }

  goToMenu(): void {
    this.router.navigate(['/arena']);
  }

  private processStateChanges(state: GameState | null): void {
    if (!state) return;

    const currentField = [...(state.player1?.field || []), ...(state.player2?.field || [])];
    const currentIds = new Set(currentField.map(c => c.id));

    // 1. Process animation events from engine
    if (state.animationEvents) {
      for (const evt of state.animationEvents) {
        if (!this.processedAnimEvents.has(evt.id)) {
          this.processedAnimEvents.add(evt.id);
          this.animatingCards.set(evt.cardId, evt.type);
          setTimeout(() => {
            this.animatingCards.delete(evt.cardId);
            this.cdr.detectChanges();
          }, evt.duration);
        }
      }
    }

    // 2. Detect Hits
    currentField.forEach(card => {
      const currentDamage = card.damageTaken || 0;
      const prevDamage = this.prevDamageMap.get(card.id) || 0;
      if (currentDamage > prevDamage) {
        this.triggerHit(card.id, currentDamage - prevDamage);
      }
      this.prevDamageMap.set(card.id, currentDamage);
    });

    // 3. Detect Deaths (was in field, now is in graveyard)
    const p1GraveIds = new Set((state.player1?.graveyard || []).map(c => c.id));
    const p2GraveIds = new Set((state.player2?.graveyard || []).map(c => c.id));

    this.prevFieldIds.forEach(id => {
      if (!currentIds.has(id)) {
        if (p1GraveIds.has(id)) {
          const deadCard = state.player1.graveyard.find(c => c.id === id);
          if (deadCard) this.triggerDeath(deadCard, state.player1.id);
        } else if (p2GraveIds.has(id)) {
          const deadCard = state.player2.graveyard.find(c => c.id === id);
          if (deadCard) this.triggerDeath(deadCard, state.player2.id);
        }
      }
    });

    this.prevFieldIds = currentIds;
  }

  private triggerHit(cardId: string, amount: number): void {
    this.hittingCards.add(cardId);
    this.lastDamageTaken.set(cardId, amount);
    setTimeout(() => {
      this.hittingCards.delete(cardId);
      this.lastDamageTaken.delete(cardId);
      this.cdr.detectChanges();
    }, 600);
  }

  private triggerDeath(card: any, ownerId: string): void {
    if (this.dyingCards.find(c => c.id === card.id)) return;
    
    this.dyingCards.push({ ...card, ownerId });
    setTimeout(() => {
      this.dyingCards = this.dyingCards.filter(c => c.id !== card.id);
      this.cdr.detectChanges();
    }, 850);
  }

  isAnimating(cardId: string, type: string): boolean {
    return this.animatingCards.get(cardId) === type;
  }

  getCardClasses(card: any): string {
    let cls = 'card-battle-mode';
    if (card.isTapped) cls += ' tapped';
    if (card.isAttacking) cls += ' attacking';
    if (card.isBlocking) cls += ' blocking';
    if (this.isHitting(card.id)) cls += ' animate-hit';
    if (card.isAttacking && !card.blockingTargetId) cls += ' ring-4';
    const pt = this.gameState?.pendingTarget;
    if (pt) {
      const isMyCard = this.me && this.me.field?.some((c: any) => c.id === card.id);
      if (pt.validTargets === 'CREATURE' || pt.validTargets === 'ANY' || (pt.validTargets === 'MY_CREATURE' && isMyCard)) {
        cls += ' targetable-glow';
      }
    }

    const animType = this.animatingCards.get(card.id);
    if (animType) cls += ' animate-' + animType;
    if (card.isAttacking) cls += ' ring-primary';
    return cls;
  }

  isHitting(cardId: string): boolean {
    return this.hittingCards.has(cardId);
  }

  getEloChange(): number | null {
    const r = this.engine.lastMatchResult;
    if (!r) return null;
    const myId = this.engine.me()?.id;
    const myIdStr = myId?.toString();
    const isWinner = r.winnerId?.toString() === myIdStr;
    if (r.player1Id?.toString() === myIdStr) {
      const raw = r.eloAfterP1 - r.eloBeforeP1;
      return isWinner ? Math.abs(raw) : -Math.abs(raw);
    }
    if (r.player2Id?.toString() === myIdStr) {
      const raw = r.eloAfterP2 - r.eloBeforeP2;
      return isWinner ? Math.abs(raw) : -Math.abs(raw);
    }
    return null;
  }

  getRecentDamage(cardId: string): number {
    return this.lastDamageTaken.get(cardId) || 0;
  }
}
