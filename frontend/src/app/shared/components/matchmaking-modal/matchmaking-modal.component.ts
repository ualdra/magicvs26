import { Component, EventEmitter, Output, OnDestroy, inject, ChangeDetectorRef, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AvatarComponent } from '../avatar/avatar.component';
import { RouterModule } from '@angular/router';
import { FriendshipService } from '../../../core/services/friendship.service';
import { DeckBuilderService } from '../../../core/services/deck-builder.service';
import { ArenaService } from '../../../core/services/arena.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-matchmaking-modal',
  standalone: true,
  imports: [CommonModule, AvatarComponent, RouterModule],
  templateUrl: './matchmaking-modal.component.html',
  styleUrl: './matchmaking-modal.component.scss'
})
export class MatchmakingModalComponent implements OnInit, OnDestroy {
  @Output() close = new EventEmitter<void>();

  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private friendshipService = inject(FriendshipService);
  private deckService = inject(DeckBuilderService);
  private arenaService = inject(ArenaService);
  private toastService = inject(ToastService);

  selectedMode: 'ranked' | 'friendly' = 'ranked';
  isSearching = false;
  searchTime = 0;
  private timerInterval: any;

  friends: any[] = [];
  
  // Deck Selection State
  userDecks: any[] = [];
  selectedDeck: any | null = null;
  tempSelectedDeck: any | null = null;
  isSelectingDeck = false;
  isLoadingDecks = false;

  ngOnInit(): void {
    this.loadFriends();
    this.loadUserDecks();
  }

  loadUserDecks(): void {
    this.isLoadingDecks = true;
    this.deckService.getUserDecks().subscribe({
      next: (decks) => {
        this.userDecks = decks;
        if (decks.length > 0) {
          // Set first deck as default or load from local preference if we had it
          this.selectedDeck = decks[0];
          this.tempSelectedDeck = decks[0];
        }
        this.isLoadingDecks = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading decks', err);
        this.isLoadingDecks = false;
        this.cdr.detectChanges();
      }
    });
  }

  toggleDeckSelection(): void {
    if (this.isSearching) return;
    this.isSelectingDeck = !this.isSelectingDeck;
    if (this.isSelectingDeck) {
      this.tempSelectedDeck = this.selectedDeck;
    }
  }

  selectTempDeck(deck: any): void {
    this.tempSelectedDeck = deck;
  }

  confirmDeckSelection(): void {
    this.selectedDeck = this.tempSelectedDeck;
    this.isSelectingDeck = false;
  }

  loadFriends(): void {
    this.friendshipService.getFriends().subscribe({
      next: (data) => {
        this.friends = data.map(f => ({
          ...f,
          status: f.isOnline ? 'En línea' : 'Desconectado'
        }));
      },
      error: (err) => console.error('Error loading friends', err)
    });
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  selectMode(mode: 'ranked' | 'friendly'): void {
    if (this.isSearching) return;
    this.selectedMode = mode;
  }

  startSearch(): void {
    if (!this.selectedDeck) {
      this.toastService.show('Por favor, selecciona un mazo primero', 'error');
      return;
    }

    this.isSearching = true;
    this.searchTime = 0;
    
    this.arenaService.joinMatchmaking(this.selectedDeck.id).subscribe({
      next: () => {
        this.timerInterval = setInterval(() => {
          this.ngZone.run(() => {
            this.searchTime++;
            this.cdr.detectChanges();
          });
        }, 1000);
      },
      error: (err) => {
        this.isSearching = false;
        this.toastService.show(err.error?.message || 'Error al iniciar búsqueda', 'error');
      }
    });
  }

  cancelSearch(): void {
    this.arenaService.leaveMatchmaking().subscribe({
      next: () => {
        this.isSearching = false;
        this.stopTimer();
      }
    });
  }

  closeModal(): void {
    this.stopTimer();
    this.close.emit();
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  get formattedTime(): string {
    const minutes = Math.floor(this.searchTime / 60);
    const seconds = this.searchTime % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  inviteFriend(friend: any): void {
    if (!friend.isOnline) return;

    this.arenaService.sendInvite(friend.id, this.selectedDeck?.id).subscribe({
      next: () => {
        this.toastService.show(`Invitación enviada a ${friend.displayName || friend.username}`, 'success');
      },
      error: (err) => {
        this.toastService.show(err.error?.message || 'Error al enviar invitación', 'error');
      }
    });
  }
}
