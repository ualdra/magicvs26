import { Component, OnInit, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CardService } from '../../core/services/card.service';
import { Card } from '../../models/card.model';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './catalog.html',
  styleUrl: './catalog.scss'
})
export class CatalogComponent implements OnInit {
  private cardService = inject(CardService);
  
  // Data Signals
  cards = signal<Card[]>([]);
  isLoading = signal(true);

  // Filter signals
  activeMana = signal<string | null>(null);
  activeType = signal('Tipo');
  activeRarity = signal('Rareza');
  searchQuery = signal('');

  // Dropdown visibility signals
  showTypeDropdown = signal(false);
  showRarityDropdown = signal(false);

  ngOnInit(): void {
    this.loadCards();
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown-trigger')) {
      this.showTypeDropdown.set(false);
      this.showRarityDropdown.set(false);
    }
  }

  toggleMana(mana: string): void {
    this.activeMana.update(current => current === mana ? null : mana);
  }

  selectType(type: string): void {
    this.activeType.set(type);
    this.showTypeDropdown.set(false);
  }

  selectRarity(rarity: string): void {
    this.activeRarity.set(rarity);
    this.showRarityDropdown.set(false);
  }

  resetFilters(): void {
    this.activeMana.set(null);
    this.activeType.set('Tipo');
    this.activeRarity.set('Rareza');
    this.searchQuery.set('');
  }

  loadCards(): void {
    this.isLoading.set(true);
    this.cardService.getCards().subscribe({
      next: (data) => {
        this.cards.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading cards:', err);
        this.isLoading.set(false);
      }
    });
  }

  getManaCostString(manaCost: string[]): string {
    return manaCost.join('');
  }
}
