import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProfileDeckSummary } from './profile.service';

@Component({
  selector: 'app-profile-deck-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './profile-deck-list.component.html',
  styleUrl: './profile-deck-list.component.scss',
})
export class ProfileDeckListComponent {
  @Input() decks: ProfileDeckSummary[] = [];
  @Input() loading = false;
  @Input() error: string | null = null;
  @Input() isOwnProfile = false;

  expandedDeckId: number | null = null;

  toggleDeck(deckId: number): void {
    this.expandedDeckId = this.expandedDeckId === deckId ? null : deckId;
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return 'No disponible';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'No disponible';
    }

    return new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  deckColors(deck: ProfileDeckSummary): string[] {
    return deck.colors ?? [];
  }
}
