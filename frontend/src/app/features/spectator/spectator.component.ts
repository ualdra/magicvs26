import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatchService } from '../../core/services/match.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-spectator',
  standalone: true,
  imports: [CommonModule, AvatarComponent],
  templateUrl: './spectator.component.html',
  styleUrls: ['./spectator.component.scss']
})
export class SpectatorComponent implements OnInit, OnDestroy {
  gameState: any = null;
  protected readonly Math = Math;
  matchId: string | null = null;
  friendId: string | null = null;
  me: any = null;
  opponent: any = null;
  hoveredCard: any = null;
  
  private pollingInterval: any = null;

  // Animation states
  private prevDamageMap = new Map<string, number>();
  private prevFieldIds = new Set<string>();
  hittingCards = new Set<string>();
  dyingCards: any[] = [];
  lastDamageTaken = new Map<string, number>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly matchService: MatchService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.matchId = this.route.snapshot.paramMap.get('id');
    this.friendId = this.route.snapshot.queryParamMap.get('friendId');
    
    if (this.matchId && this.friendId) {
      this.pollState();
      this.pollingInterval = setInterval(() => this.pollState(), 3000);
    } else {
      this.goToMenu();
    }
  }

  ngOnDestroy(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
  }

  private pollState(): void {
    this.matchService.getSpectatorState(this.matchId!, this.friendId!).subscribe({
      next: (state: any) => {
        this.gameState = state;
        
        // Orient the board: "me" is the friend we are spectating
        if (state.player1?.id === this.friendId) {
          this.me = state.player1;
          this.opponent = state.player2;
        } else {
          this.me = state.player2;
          this.opponent = state.player1;
        }

        this.processStateChanges(state);
        this.cdr.detectChanges();
      },
      error: () => {
        // If error or game finished, maybe redirect or stop polling
        clearInterval(this.pollingInterval);
      }
    });
  }

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
      return type.includes('land') || type.includes('tierra') || name.includes('tierra') || 
             name.includes('isla') || name.includes('pantano') || name.includes('montaña') || 
             name.includes('bosque') || name.includes('llanura') || name.includes('templo');
    }) || [];
  }

  getNonLands(cards: any[]): any[] {
    const lands = this.getLands(cards);
    return cards?.filter(c => !lands.find(l => l.id === c.id)) || [];
  }

  getColorCode(color: string): string {
    const map: any = { W: '#fcd34d', U: '#3b82f6', B: '#a855f7', R: '#ef4444', G: '#22c55e', C: '#94a3b8' };
    return map[color.toUpperCase()] || '#94a3b8';
  }

  getColorIcon(color: string): string {
    const map: any = { W: 'sunny', U: 'water_drop', B: 'skull', R: 'local_fire_department', G: 'forest', C: 'blur_on' };
    return map[color.toUpperCase()] || 'help';
  }

  getColorName(color: string): string {
    const map: any = { W: 'Blanco', U: 'Azul', B: 'Negro', R: 'Rojo', G: 'Verde', C: 'Incoloro' };
    return map[color.toUpperCase()] || 'Desconocido';
  }

  getRemainingToughness(card: any, player: any): number {
    const baseT = parseInt(card.toughness || '0', 10);
    const d = card.damageTaken || 0;
    return baseT - d; // Simplified since we don't have engine modifications here
  }

  getCardById(id: string): any {
    return this.opponent?.field?.find((c: any) => c.id === id) || this.me?.field?.find((c: any) => c.id === id);
  }

  goToMenu(): void {
    this.router.navigate(['/arena']);
  }

  // Disable interactions
  showVictoryModal = false;
  engine: any = {
    getIsProcessing: () => false,
    targetPlayer: (id: string) => {},
    getModifiedPower: (card: any, player: any) => parseInt(card.power || '0', 10),
    payGenericMana: (key: any) => {},
    cancelPayment: () => {},
    resolveManaChoice: (color: string) => {},
    autoPayGeneric: () => {}
  };

  onPassPriority(): void {}
  onPlayCard(cardId: string): void {}
  onMulligan(): void {}
  onKeep(): void {}
  onTapCard(cardId: string): void {}
  onConcede(): void {
    this.goToMenu();
  }
  toggleBlockerOrderSelection(id: string): void {}
  submitBlockerOrder(): void {}
  isBlockerSelected(id: string): boolean { return false; }
  getBlockerSelectionIndex(id: string): number { return -1; }
  isBlockerOrderComplete(): boolean { return false; }

  private processStateChanges(state: any): void {
    if (!state) return;

    const currentField = [...(state.player1?.field || []), ...(state.player2?.field || [])];
    const currentIds = new Set(currentField.map(c => c.id));

    // 1. Detect Hits
    currentField.forEach(card => {
      const currentDamage = card.damageTaken || 0;
      const prevDamage = this.prevDamageMap.get(card.id) || 0;
      if (currentDamage > prevDamage) {
        this.triggerHit(card.id, currentDamage - prevDamage);
      }
      this.prevDamageMap.set(card.id, currentDamage);
    });

    // 2. Detect Deaths (was in field, now is in graveyard)
    const p1GraveIds = new Set((state.player1?.graveyard || []).map((c: any) => c.id));
    const p2GraveIds = new Set((state.player2?.graveyard || []).map((c: any) => c.id));

    this.prevFieldIds.forEach(id => {
      if (!currentIds.has(id)) {
        if (p1GraveIds.has(id)) {
          const deadCard = state.player1.graveyard.find((c: any) => c.id === id);
          if (deadCard) this.triggerDeath(deadCard, state.player1.id);
        } else if (p2GraveIds.has(id)) {
          const deadCard = state.player2.graveyard.find((c: any) => c.id === id);
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

  isHitting(cardId: string): boolean {
    return this.hittingCards.has(cardId);
  }

  getRecentDamage(cardId: string): number {
    return this.lastDamageTaken.get(cardId) || 0;
  }
}
