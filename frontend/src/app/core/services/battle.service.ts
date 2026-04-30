import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { GameState, GameCard, GamePhase } from '../../models/game.model';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root'
})
export class BattleService {
  private http = inject(HttpClient);
  private userService = inject(UserService);
  private apiUrl = 'http://localhost:8080/api/battle';

  constructor() { }

  getBattleState(matchId: string): Observable<GameState> {
    return this.http.get<any>(`${this.apiUrl}/${matchId}/state`).pipe(
      map(state => this.mapBackendToFrontend(state, this.userService.getCurrentUser()?.id || ''))
    );
  }

  pushState(matchId: string, state: GameState): Observable<void> {
    console.log('📤 Pushing state to server:', {
      phase: state.currentPhase,
      pendingOrders: state.pendingBlockerOrders?.length || 0,
      attacker: state.player1.field.find(c => c.orderedBlockers)?.name || state.player2.field.find(c => c.orderedBlockers)?.name
    });
    return this.http.post<void>(`${this.apiUrl}/${matchId}/state`, state);
  }

  private mapBackendToFrontend(backend: any, myId: string): GameState {
    return {
      matchId: (backend.matchId || backend.id)?.toString() || '',
      turnCount: backend.turnCount || 1,
      activePlayerId: (backend.activePlayerId || backend.currentTurn)?.toString() || '',
      priorityPlayerId: backend.priorityPlayerId || (backend.activePlayerId || backend.currentTurn)?.toString() || '',
      passedCount: backend.passedCount || 0,
      stack: (backend.stack || []).map((item: any) => ({
        ...item,
        card: item.card ? this.mapCard(item.card) : undefined
      })),
      currentPhase: (backend.currentPhase || backend.phase) as GamePhase || GamePhase.MULLIGAN,
      animationStatus: backend.animationStatus || 'IDLE',
      player1: this.mapPlayerState(backend.player1),
      player2: this.mapPlayerState(backend.player2),
      landsPlayedThisTurn: backend.landsPlayedThisTurn || 0,
      pendingManaChoice: backend.pendingManaChoice,
      pendingBlockerOrders: backend.pendingBlockerOrders
    };
  }

  private mapPlayerState(p: any): any {
    if (!p) return null;
    return {
      id: (p.id || p.userId)?.toString(),
      username: p.username,
      avatarUrl: p.avatarUrl,
      hp: p.hp,
      library: (p.library || []).map((c: any) => this.mapCard(c)),
      hand: (p.hand || []).map((c: any) => this.mapCard(c)),
      field: (p.field || []).map((c: any) => this.mapCard(c)),
      graveyard: (p.graveyard || []).map((c: any) => this.mapCard(c)),
      libraryCount: p.libraryCount ?? p.library?.length ?? 0,
      graveyardCount: p.graveyardCount ?? p.graveyard?.length ?? 0,
      handCount: p.handCount ?? p.hand?.length ?? 0,
      mulliganCount: p.mulliganCount || 0,
      isReady: p.isReady ?? p.ready ?? false,
      manaPool: p.manaPool || { white: 0, blue: 0, black: 0, red: 0, green: 0, colorless: 0 }
    };
  }

  private mapCard(c: any): GameCard {
    return {
      id: c.id,
      name: c.name,
      imageUrl: c.imageUrl,
      isTapped: c.isTapped ?? c.tapped ?? false,
      isAttacking: c.isAttacking ?? false,
      isBlocking: c.isBlocking ?? false,
      blockingTargetId: c.blockingTargetId,
      type: c.type,
      oracleText: c.oracleText || '',
      manaCost: c.manaCost || [],
      power: c.power,
      toughness: c.toughness,
      damageTaken: c.damageTaken || 0,
      orderedBlockers: c.orderedBlockers,
      producedMana: c.producedMana,
      enteredFieldTurn: c.enteredFieldTurn ?? -1
    };
  }
}
