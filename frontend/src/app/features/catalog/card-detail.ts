import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { CardService } from '../../core/services/card.service';
import { Card } from '../../models/card.model';
import { Observable, map, switchMap } from 'rxjs';

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
  
  card?: Card;
  isLoading = true;
  defaultImageUrl = 'https://cards.scryfall.io/art_crop/front/b/8/b8622d43-4815-44fa-8a7f-611427728468.jpg?1765674064';

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadCard(id);
    }
  }



  loadCard(id: string): void {
    this.isLoading = true;
    this.cardService.getCardById(id).subscribe({
      next: (data) => {
        this.card = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading card:', err);
        this.isLoading = false;
      }
    });
    
  card$!: Observable<Card | undefined>;

  ngOnInit(): void {
    this.card$ = this.route.paramMap.pipe(
      map(params => params.get('id')),
      switchMap(id => {
        if (id) {
          return this.cardService.getCardById(id);
        }
        return new Observable<undefined>(subscriber => subscriber.next(undefined));
      })
    );
  }

  goBack(): void {
    this.location.back();
  }

  isNaN(val: any): boolean {
    return isNaN(Number(val));
  }
}
