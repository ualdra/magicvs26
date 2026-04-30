import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CardService } from '../../core/services/card.service';
import { Card } from '../../models/card.model';
import { Observable, map, switchMap, of, tap } from 'rxjs';

@Component({
  selector: 'app-card-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './card-detail.html',
  styleUrl: './card-detail.scss'
})
export class CardDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private cardService = inject(CardService);
  private location = inject(Location);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  
  card$!: Observable<Card | undefined>;
  defaultImageUrl = 'https://cards.scryfall.io/art_crop/front/b/8/b8622d43-4815-44fa-8a7f-611427728468.jpg?1765674064';
  isFlipped = false;
  isFavorite = false;

  get fillStyle(): string {
    return this.isFavorite ? "'FILL' 1" : "'FILL' 0";
  }

  toggleFlip(event?: MouseEvent): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.isFlipped = !this.isFlipped;
  }

  ngOnInit(): void {
    this.card$ = this.route.paramMap.pipe(
      map(params => params.get('id')),
      switchMap(id => {
        if (id) {
          this.checkFavorite(id);
          return this.cardService.getCardById(id);
        }
        return of(undefined);
      })
    );
  }

  goBack(): void {
    this.location.back();
  }

  checkFavorite(cardId: string): void {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    if (token) {
      this.cardService.checkFavoriteStatus(cardId).subscribe(res => {
        this.isFavorite = res.isFavorite;
        this.cdr.detectChanges();
      });
    }
  }

  toggleFavoriteCard(cardId: string): void {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    if (!token) {
      this.router.navigate(['/registro']);
      return;
    }
    this.cardService.toggleFavorite(cardId).subscribe(res => {
      this.isFavorite = res.isFavorite;
      this.cdr.detectChanges();
    });
  }

  isNaN(val: any): boolean {
    return isNaN(Number(val));
  }

  onCardMouseMove(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement | null;
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const halfW = rect.width / 2;
    const halfH = rect.height / 2;
    const rotateY = ((x - halfW) / halfW) * 8;
    const rotateX = ((halfH - y) / halfH) * 8;

    target.style.setProperty('--tilt-x', `${rotateX.toFixed(2)}deg`);
    target.style.setProperty('--tilt-y', `${rotateY.toFixed(2)}deg`);
    target.style.setProperty('--glow-x', `${((x / rect.width) * 100).toFixed(2)}%`);
    target.style.setProperty('--glow-y', `${((y / rect.height) * 100).toFixed(2)}%`);
  }

  onCardMouseLeave(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement | null;
    if (!target) return;

    target.style.setProperty('--tilt-x', '0deg');
    target.style.setProperty('--tilt-y', '0deg');
    target.style.setProperty('--glow-x', '50%');
    target.style.setProperty('--glow-y', '50%');
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
    return map[rarity.toLowerCase()] || rarity;
  }
}