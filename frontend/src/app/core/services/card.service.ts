import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
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

  searchCards(query = '', color = '', type = '', rarity = '', page = 0, size = 20, favoritesOnly = false): Observable<CardPage> {
    const params: Record<string, string> = {
      name: query,
      color,
      type,
      rarity,
      page: String(page),
      size: String(size),
      favoritesOnly: String(favoritesOnly)
    };
    
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    const headers = token && favoritesOnly ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();

    return this.http.get<any>(`${this.apiUrl}/search`, { params, headers }).pipe(
      map(response => this.mapSearchResponseToCardPage(response, page, size))
    );
  }

  checkFavoriteStatus(cardId: string): Observable<{ isFavorite: boolean }> {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
    return this.http.get<{ isFavorite: boolean }>(`${this.apiUrl}/${cardId}/favorite`, { headers });
  }

  toggleFavorite(cardId: string): Observable<{ isFavorite: boolean }> {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
    return this.http.post<{ isFavorite: boolean }>(`${this.apiUrl}/${cardId}/favorite`, {}, { headers });
  }

  getStats(): Observable<{ totalCards: number; totalSets: number }> {
    return this.http.get<{ totalCards: number; totalSets: number }>(`${this.apiUrl}/stats`);
  }

  private mapSearchResponseToCardPage(response: any, currentPage: number, size: number): CardPage {
    const cards = Array.isArray(response.content)
      ? response.content.map((c: any) => this.mapSearchCardToCard(c))
      : [];
    return {
      cards,
      totalPages: response.totalPages || 0,
      totalElements: response.totalElements || 0,
      currentPage: response.page ?? currentPage,
      size
    };
  }

  private mapSearchCardToCard(card: any): Card {
    return {
      id: String(card.id),
      name: card.name || '',
      imageUrl: card.imageUrl || '',
      imageUrl2: card.backImageUrl || '',
      manaCost: this.parseManaCost(card.manaCost),
      type: card.type || '',
      rarity: this.capitalize(card.rarity) || '',
      oracleText: '',
      legalities: this.normalizeLegalities([]),
      price: 0
    };
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
    return {
      id: String(card.id),
      name: card.name || '',
      imageUrl: card.normalImageUri || card.smallImageUri || card.largeImageUri || card.pngImageUri || '',
      imageUrl2: card.backImageUri || '',
      manaCost: this.parseManaCost(card.manaCost),
      type: card.typeLine || card.layout || '',
      rarity: this.capitalize(card.rarity) || '',
      oracleText: card.oracleText || '',
      flavorText: card.flavorText || '',
      powerToughness: card.power && card.toughness ? `${card.power}/${card.toughness}` : undefined,
      legalities: this.normalizeLegalities(card.legalities),
      price: this.normalizePrice(card.price),
      edhrecRank: card.edhrecRank,
      setName: card.setName,
      collectorNumber: card.collectorNumber,
      cmc: card.cmc,
      releasedAt: card.releasedAt,
      artist: card.artist,
      faces: card.faces ? card.faces.map((f: any) => ({
        name: f.name,
        manaCost: this.parseManaCost(f.manaCost),
        type: f.typeLine,
        oracleText: f.oracleText,
        flavorText: f.flavorText,
        powerToughness: f.power && f.toughness ? `${f.power}/${f.toughness}` : undefined,
        imageUrl: f.normalImageUri
      })) : undefined
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
    // Usamos los strings exactos que TypeScript espera (Mayúsculas y espacios)
    const defaultLegalities: Card['legalities'] = {
      standard: 'Not Legal',
      pioneer: 'Not Legal',
      modern: 'Not Legal',
      commander: 'Not Legal'
    };

    if (!Array.isArray(legalities)) {
      return defaultLegalities;
    }

    return legalities.reduce((result: Card['legalities'], entry: any) => {
      const format = entry.formatName?.toLowerCase();
      
      // Mapeamos lo que viene del backend (ej: "not_legal") a lo que quiere el modelo (ej: "Not Legal")
      let status: "Legal" | "Banned" | "Not Legal" = 'Not Legal';
      
      if (entry.legalityStatus === 'legal' || entry.legalityStatus === 'Legal') status = 'Legal';
      if (entry.legalityStatus === 'banned' || entry.legalityStatus === 'Banned') status = 'Banned';

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