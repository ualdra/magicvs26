import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BoosterService } from '../../core/services/booster.service';
import { CardSummary } from '../../models/user-card.model';

@Component({
  selector: 'app-booster',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './booster.component.html',
  styleUrls: ['./booster.component.scss']
})
export class BoosterComponent {
  private boosterService = inject(BoosterService);
  private cdr = inject(ChangeDetectorRef);
  
  openedCards: CardSummary[] = [];
  isOpening = false;
  error: string | null = null;

  openBooster() {
    this.isOpening = true;
    this.error = null;
    this.openedCards = [];
    
    this.boosterService.openBooster().subscribe({
      next: (cards) => {
        this.openedCards = [];
        this.cdr.detectChanges();
        setTimeout(() => {
          this.openedCards = cards;
          this.isOpening = false;
          this.cdr.detectChanges();
        }, 50);
      },
      error: (err) => {
        console.error('Error opening booster', err);
        this.error = 'Hubo un error al abrir el sobre. Inténtalo de nuevo.';
        this.isOpening = false;
      }
    });
  }

  getRarityClass(rarity: string): string {
    switch (rarity.toLowerCase()) {
      case 'mythic': return 'text-orange-500 font-bold';
      case 'rare': return 'text-yellow-400 font-bold';
      case 'uncommon': return 'text-slate-300 font-semibold';
      case 'common': return 'text-white';
      default: return 'text-gray-400';
    }
  }

  translateRarity(rarity: string): string {
    const map: Record<string, string> = {
      'common': 'Común',
      'uncommon': 'Infrecuente',
      'rare': 'Rara',
      'mythic': 'Mítica',
      'special': 'Especial',
      'bonus': 'Bonus'
    };
    return map[(rarity || '').toLowerCase()] || rarity;
  }
}
