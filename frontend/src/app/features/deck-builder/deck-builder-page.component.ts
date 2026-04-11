import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DeckBuilderService, Card } from '../../core/services/deck-builder.service';
import { DeckSearchPanelComponent } from './deck-search-panel.component';

@Component({
  selector: 'app-deck-builder-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DeckSearchPanelComponent],
  templateUrl: './deck-builder-page.html',
  styleUrls: ['./deck-builder-page.scss']
})
export class DeckBuilderPageComponent {
  private deckService = inject(DeckBuilderService);

  // Signals expuestas del servicio
  deckName = this.deckService.deckName;
  deckDescription = this.deckService.deckDescription;
  deckFormat = this.deckService.deckFormat;
  deckIsPublic = this.deckService.deckIsPublic;
  deckCards = this.deckService.deckCards;
  totalCards = this.deckService.totalCards;
  deckColors = this.deckService.deckColors;
  isValidDeck = this.deckService.isValidDeck;
  validationMessage = this.deckService.validationMessage;
  loading = this.deckService.loading;
  error = this.deckService.error;

  formats = ['STANDARD', 'MODERN', 'LEGACY', 'PAUPER'];

  onNameChange(value: string): void {
    this.deckService.setDeckName(value);
  }

  onDescriptionChange(value: string): void {
    this.deckService.setDeckDescription(value);
  }

  onFormatChange(value: string): void {
    this.deckService.setDeckFormat(value);
  }

  onIsPublicChange(value: boolean): void {
    this.deckService.setDeckIsPublic(value);
  }

  onCardSelected(card: Card): void {
    this.deckService.addCard(card, 1);
  }

  onRemoveCard(cardId: number): void {
    this.deckService.removeCard(cardId);
  }

  onUpdateQuantity(cardId: number, quantity: number): void {
    this.deckService.updateCardQuantity(cardId, quantity);
  }

  saveDeck(): void {
    if (!this.isValidDeck()) {
      return;
    }

    this.deckService.saveDeck().subscribe({
      next: (response) => {
        console.log('Mazo guardado:', response);
        // Aquí puedes navegar o mostrar un mensaje de éxito
      },
      error: (error) => {
        console.error('Error saving deck:', error);
      }
    });
  }

  clearDeck(): void {
    if (confirm('¿Estás seguro de que quieres limpiar el mazo?')) {
      this.deckService.clearDeck();
    }
  }

  getColorClass(color: string): string {
    const colorMap: { [key: string]: string } = {
      'white': 'bg-yellow-100 text-yellow-800',
      'blue': 'bg-blue-100 text-blue-800',
      'black': 'bg-gray-800 text-white',
      'red': 'bg-red-100 text-red-800',
      'green': 'bg-green-100 text-green-800'
    };
    return colorMap[color] || 'bg-gray-100 text-gray-800';
  }
}
