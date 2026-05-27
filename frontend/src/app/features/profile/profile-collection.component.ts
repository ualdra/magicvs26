import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { UserCard } from '../../models/user-card.model';

@Component({
  selector: 'app-profile-collection',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './profile-collection.component.html',
  styleUrls: ['./profile-collection.component.scss']
})
export class ProfileCollectionComponent {
  @Input() collection: UserCard[] = [];
  @Input() loading = false;
  @Input() error: string | null = null;
  @Input() isOwnProfile = false;

  getRarityClass(rarity: string): string {
    if (!rarity) return 'text-white';
    switch (rarity.toLowerCase()) {
      case 'mythic': return 'text-orange-500 font-bold';
      case 'rare': return 'text-yellow-400 font-bold';
      case 'uncommon': return 'text-slate-300 font-semibold';
      case 'common': return 'text-white';
      default: return 'text-white';
    }
  }

  get sortedAndLimitedCollection(): UserCard[] {
    const rarityOrder: { [key: string]: number } = {
      'mythic': 4,
      'rare': 3,
      'uncommon': 2,
      'common': 1
    };
    
    return [...this.collection].sort((a, b) => {
      const rarityA = rarityOrder[a.rarity?.toLowerCase() || ''] || 0;
      const rarityB = rarityOrder[b.rarity?.toLowerCase() || ''] || 0;
      
      if (rarityA !== rarityB) {
        return rarityB - rarityA;
      }
      
      return (b.quantity || 0) - (a.quantity || 0);
    }).slice(0, 8);
  }

  translateRarity(rarity: string | undefined): string {
    if (!rarity) return '';
    const map: Record<string, string> = {
      'common': 'Común',
      'uncommon': 'Infrecuente',
      'rare': 'Rara',
      'mythic': 'Mítica',
      'special': 'Especial',
      'bonus': 'Bonus'
    };
    return map[rarity.toLowerCase()] || rarity;
  }
}
