import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DeckBuilderService, Deck, DeckCard } from '../../../core/services/deck-builder.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-deck-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './deck-detail.component.html',
  styleUrl: './deck-detail.component.scss'
})
export class DeckDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private deckService = inject(DeckBuilderService);
  private location = inject(Location);

  deck = signal<Deck | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);
  currentUserId = signal<number | null>(null);

  readonly groupedCards = computed(() => {
    const d = this.deck();
    if (!d) return [];

    const groups = new Map<string, DeckCard[]>();
    d.cards.forEach(card => {
      const type = this.resolveTypeGroup(card.cardType);
      if (!groups.has(type)) groups.set(type, []);
      groups.get(type)!.push(card);
    });

    return Array.from(groups.entries()).map(([name, cards]) => ({
      name,
      count: cards.reduce((sum, c) => sum + c.quantity, 0),
      cards: cards.sort((a, b) => a.cardName.localeCompare(b.cardName))
    })).sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly manaCurve = computed(() => {
    const d = this.deck();
    if (!d || !d.cards) return [];
    
    const buckets = [0, 0, 0, 0, 0, 0, 0, 0];
    d.cards.forEach(card => {
      const cmc = this.extractManaValue(card.manaCost);
      const index = Math.min(cmc, 7);
      buckets[index] += card.quantity;
    });

    return buckets.map((value, index) => ({
      label: index === 7 ? '7+' : String(index),
      value
    }));
  });

  readonly maxCurveValue = computed(() => Math.max(1, ...this.manaCurve().map(b => b.value)));

  ngOnInit(): void {
    this.loadCurrentUserId();
    this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.loadDeck(Number(id));
      }
    });
  }

  loadCurrentUserId(): void {
    const raw = localStorage.getItem('user');
    if (raw) {
      try {
        const u = JSON.parse(raw);
        this.currentUserId.set(u.id);
      } catch (e) {
        console.error('Error parsing stored user:', e);
      }
    }
  }

  loadDeck(id: number): void {
    this.isLoading.set(true);
    this.deckService.getDeckById(id)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (data) => this.deck.set(data),
        error: (err) => this.error.set(err.error?.message || 'Error al cargar el mazo')
      });
  }

  goBack(): void {
    this.location.back();
  }

  getCurveBarHeight(value: number): number {
    if (value <= 0) return 4;
    const maxValue = this.maxCurveValue();
    const maxBarHeight = 64; // Estándar del creador
    return Math.max(8, Math.round((value / maxValue) * maxBarHeight));
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

  private extractManaValue(manaCost: string): number {
    if (!manaCost) return 0;
    
    let total = 0;
    const symbols = manaCost.match(/\{([^}]+)\}/g) || [];
    symbols.forEach(symbol => {
      const value = symbol.replace(/[{}]/g, '');
      if (/^\d+$/.test(value)) total += Number(value);
      else total += 1; // Simplificado como en el creador
    });

    return total;
  }
}
