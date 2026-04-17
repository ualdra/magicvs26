import { Component, computed, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DeckBuilderService, Card, DeckCard } from '../../core/services/deck-builder.service';
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
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  // Signals expuestas del servicio
  deckName = this.deckService.deckName;
  deckDescription = this.deckService.deckDescription;
  deckIsPublic = this.deckService.deckIsPublic;
  deckCards = this.deckService.deckCards;
  totalCards = this.deckService.totalCards;
  deckColors = this.deckService.deckColors;
  isValidDeck = this.deckService.isValidDeck;
  validationMessage = this.deckService.validationMessage;
  loading = this.deckService.loading;
  error = this.deckService.error;

  isEditing = false;
  editingDeckId: number | null = null;
  loadingDeck = false;
  notificationMessage: string | null = null;
  notificationType: 'success' | 'error' | 'info' = 'success';
  private notificationTimer?: number;

  readonly deckFormatLabel = 'Standard';

  readonly groupedDeckCards = computed(() => {
    const groups = new Map<string, DeckCard[]>();

    this.deckCards().forEach((card) => {
      const group = this.resolveTypeGroup(card.cardType);
      if (!groups.has(group)) {
        groups.set(group, []);
      }
      groups.get(group)!.push(card);
    });

    return Array.from(groups.entries())
      .map(([group, cards]) => ({
        group,
        cards: cards.sort((a, b) => a.cardName.localeCompare(b.cardName))
      }))
      .sort((a, b) => a.group.localeCompare(b.group));
  });

  readonly manaCurve = computed(() => {
    const buckets = [0, 0, 0, 0, 0, 0, 0, 0];

    this.deckCards().forEach((card) => {
      const cmc = this.extractManaValue(card.manaCost);
      const index = Math.min(cmc, 7);
      buckets[index] += card.quantity;
    });

    return buckets.map((value, index) => ({
      label: index === 7 ? '7+' : String(index),
      value
    }));
  });

  readonly maxCurveValue = computed(() => Math.max(1, ...this.manaCurve().map((bucket) => bucket.value)));

  readonly deckGoal = 60;

  get pageTitle(): string {
    return this.isEditing ? 'Editor de Mazos' : 'Creador de Mazos';
  }

  get pageSubtitle(): string {
    return this.isEditing
      ? 'Carga un mazo existente, ajusta su lista y guarda los cambios manteniendo la estética premium.'
      : 'Construye, ajusta y optimiza tu estrategia en Standard con una experiencia visual fluida.';
  }

  get modeLabel(): string {
    return this.isEditing ? 'Edición' : 'Creación';
  }

  readonly deckProgressPercent = computed(() => {
    const ratio = (this.totalCards() / this.deckGoal) * 100;
    return Math.max(0, Math.min(100, ratio));
  });

  constructor() {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const rawDeckId = params.get('deckId');
        if (!rawDeckId) {
          this.isEditing = false;
          this.editingDeckId = null;
          this.deckService.clearDeck();
          return;
        }

        const deckId = Number(rawDeckId);
        if (Number.isNaN(deckId)) {
          this.showNotification('El mazo solicitado no es válido.', 'error');
          return;
        }

        this.isEditing = true;
        this.editingDeckId = deckId;
        this.loadDeck(deckId);
      });

    const navigationState = history.state as { notificationMessage?: string; notificationType?: 'success' | 'error' | 'info' };
    if (navigationState?.notificationMessage) {
      this.showNotification(navigationState.notificationMessage, navigationState.notificationType || 'success');
      history.replaceState({}, document.title);
    }
  }

  onNameChange(value: string): void {
    this.deckService.setDeckName(value);
  }

  onDescriptionChange(value: string): void {
    this.deckService.setDeckDescription(value);
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
      this.showNotification('El mazo debe tener exactamente 60 cartas.', 'error');
      return;
    }

    const save$ = this.editingDeckId != null
      ? this.deckService.saveDeck(this.editingDeckId)
      : this.deckService.saveDeck();

    save$.subscribe({
      next: (response) => {
        const deckId = response?.id ?? this.editingDeckId;
        this.showNotification(
          this.editingDeckId != null ? 'Cambios guardados correctamente.' : 'Mazo creado correctamente.',
          'success'
        );

        if (deckId != null && this.editingDeckId == null) {
          this.editingDeckId = deckId;
          this.isEditing = true;
          this.router.navigate(['/decks', deckId, 'edit'], {
            replaceUrl: true,
            state: {
              notificationMessage: 'Mazo creado correctamente.',
              notificationType: 'success'
            }
          });
        }
      },
      error: (error) => {
        this.showNotification(error?.error?.message || 'Error saving deck', 'error');
      }
    });
  }

  clearDeck(): void {
    if (confirm('¿Estás seguro de que quieres limpiar el mazo?')) {
      this.deckService.clearDeck();
    }
  }

  getQuantityMax(cardType: string): number {
    return this.deckService.isBasicLandType(cardType) ? 99 : 4;
  }

  private loadDeck(deckId: number): void {
    this.loadingDeck = true;
    this.deckService.clearDeck();
    this.deckService.getDeckById(deckId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (deck) => {
          this.deckService.loadDeck(deck);
          this.loadingDeck = false;
        },
        error: (error) => {
          this.loadingDeck = false;
          this.showNotification(error?.error?.message || 'No se pudo cargar el mazo.', 'error');
        }
      });
  }

  private showNotification(message: string, type: 'success' | 'error' | 'info'): void {
    this.notificationMessage = message;
    this.notificationType = type;

    if (this.notificationTimer) {
      window.clearTimeout(this.notificationTimer);
    }

    this.notificationTimer = window.setTimeout(() => {
      this.notificationMessage = null;
    }, 3200);
  }

  getColorClass(color: string): string {
    const colorMap: { [key: string]: string } = {
      white: 'bg-amber-100/10 text-amber-200 border border-amber-200/20',
      blue: 'bg-sky-100/10 text-sky-200 border border-sky-200/20',
      black: 'bg-violet-100/10 text-violet-200 border border-violet-200/20',
      red: 'bg-rose-100/10 text-rose-200 border border-rose-200/20',
      green: 'bg-emerald-100/10 text-emerald-200 border border-emerald-200/20'
    };
    return colorMap[color] || 'bg-surface-container text-on-surface border border-outline-variant';
  }

  getCurveBarHeight(value: number): number {
    // Keep the previous visual baseline while allowing clear ascending growth.
    if (value <= 0) {
      return 8;
    }

    const maxValue = this.maxCurveValue();
    const maxBarHeight = 64;
    return Math.max(12, Math.round((value / maxValue) * maxBarHeight));
  }

  private extractManaValue(manaCost: string): number {
    if (!manaCost) {
      return 0;
    }

    let total = 0;
    const symbols = manaCost.match(/\{([^}]+)\}/g) || [];
    symbols.forEach((symbol) => {
      const value = symbol.replace(/[{}]/g, '');
      if (/^\d+$/.test(value)) {
        total += Number(value);
        return;
      }
      total += 1;
    });

    return total;
  }

  private resolveTypeGroup(typeLine: string): string {
    const normalized = (typeLine || '').toLowerCase();

    if (normalized.includes('creature') || normalized.includes('criatura')) return 'Criaturas';
    if (normalized.includes('instant') || normalized.includes('instantáneo')) return 'Instantáneos';
    if (normalized.includes('sorcery') || normalized.includes('conjuro')) return 'Conjuros';
    if (normalized.includes('enchantment') || normalized.includes('encantamiento')) return 'Encantamientos';
    if (normalized.includes('artifact') || normalized.includes('artefacto')) return 'Artefactos';
    if (normalized.includes('planeswalker')) return 'Planeswalkers';
    if (normalized.includes('land') || normalized.includes('tierra')) return 'Tierras';

    return 'Otros';
  }
}
