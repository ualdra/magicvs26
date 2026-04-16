import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Card } from '../../models/card.model';

export interface CardPage {
  cards: Card[];
  totalPages: number;
  totalElements: number;
  currentPage: number;
  size: number;
}

@Injectable({ providedIn: 'root' })
export class CardService {
  
  private apiUrl = 'http://localhost:8080/api/cards';

  constructor(private http: HttpClient) {}

  getCards(page = 0, size = 20): Observable<CardPage> {
    return this.http.get<any>(`${this.apiUrl}/list?page=${page}&size=${size}`).pipe(
      map(response => this.mapResponseToCardPage(response, page, size))
    );
  }

  getCardById(id: string): Observable<Card> {
    return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
      map(card => this.mapBackendCardToCard(card))
    );
  }

  getStats(): Observable<{ totalCards: number; totalSets: number }> {
    return this.http.get<{ totalCards: number; totalSets: number }>(`${this.apiUrl}/stats`);
  }

  private mapResponseToCardPage(response: any, currentPage: number, size: number): CardPage {
    const cards = this.mapPageToCards(response);
    return {
      cards,
      totalPages: response.totalPages || 0,
      totalElements: response.totalElements || 0,
      currentPage,
      size
    };
  }

  private mapPageToCards(response: any): Card[] {
    if (!response || !Array.isArray(response.content)) {
      return [];
    }
    return response.content.map((card: any) => this.mapBackendCardToCard(card));
  }

  private mapBackendCardToCard(card: any): Card {
    // Manejo especial para cartas con doble cara
    if(card.name.includes('//')) {
      const nameParts = card.name.split(' // ');
      const firstName = nameParts[0].trim();
      const secondName = nameParts[1].trim();
     
    }
    
    return {
      id: String(card.id),
      name: card.name || '',
      imageUrl: card.normalImageUri || card.smallImageUri || card.largeImageUri || card.pngImageUri || '',
      imageUrl2: '',
      manaCost: this.parseManaCost(card.manaCost),
      type: card.typeLine || card.layout || '',
      rarity: this.capitalize(card.rarity) || '',
      oracleText: card.oracleText || '',
      flavorText: card.flavorText || '',
      powerToughness: card.power && card.toughness ? `${card.power}/${card.toughness}` : undefined,
      legalities: this.normalizeLegalities(card.legalities),
      price: this.normalizePrice(card.price)
    };
  }

  private parseManaCost(manaCost?: string): string[] {
    if (!manaCost) {
      return [];
    }
    const matches = manaCost.match(/\{([^}]+)\}/g);
    if (!matches) {
      return [manaCost];
    }
    return matches.map(symbol => symbol.slice(1, -1));
  }

  private normalizeLegalities(legalities: any): Card['legalities'] {
    const defaultLegalities = {
      standard: 'not_legal' as const,
      pioneer: 'not_legal' as const,
      modern: 'not_legal' as const,
      commander: 'not_legal' as const
    };

    if (!Array.isArray(legalities)) {
      return defaultLegalities;
    }

    return legalities.reduce((result: Card['legalities'], entry: any) => {
      const format = entry.formatName?.toLowerCase();
      const status = entry.legalityStatus || 'not_legal';
      if (format in result) {
        (result as any)[format] = status;
      }
      return result;
    }, { ...defaultLegalities });
  }

  private normalizePrice(price: any): number {
    if (!price) {
      return 0;
    }
    return Number(price.usd || 0);
  }

  private capitalize(value?: string): string {
    if (!value) {
      return '';
    }
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
