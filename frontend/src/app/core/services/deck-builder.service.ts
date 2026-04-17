import { Injectable, signal, computed, effect } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Card {
  id: number;
  name: string;
  manaCost: string;
  type: string;
  imageUrl: string;
  backImageUrl?: string;
  doubleFaced?: boolean;
  colors: string[];
}

export interface DeckCard {
  cardId: number;
  cardName: string;
  cardImage: string;
  backCardImage?: string;
  doubleFaced?: boolean;
  manaCost: string;
  cardType: string;
  quantity: number;
}

export interface Deck {
  id?: number;
  name: string;
  description: string;
  format: string;
  isPublic: boolean;
  totalCards?: number;
  cards: DeckCard[];
}

@Injectable({
  providedIn: 'root'
})
export class DeckBuilderService {
  private readonly apiUrl = 'http://localhost:8080/api/decks';
  private readonly minDeckCards = 60;

  // Signals
  private deckNameSignal = signal<string>('Mi Nuevo Mazo');
  private deckDescriptionSignal = signal<string>('');
  private deckFormatSignal = signal<string>('STANDARD');
  private deckIsPublicSignal = signal<boolean>(false);
  private deckCardsSignal = signal<DeckCard[]>([]);
  private loadingSignal = signal<boolean>(false);
  private errorSignal = signal<string | null>(null);

  // Computed signals
  readonly deckName = this.deckNameSignal.asReadonly();
  readonly deckDescription = this.deckDescriptionSignal.asReadonly();
  readonly deckFormat = this.deckFormatSignal.asReadonly();
  readonly deckIsPublic = this.deckIsPublicSignal.asReadonly();
  readonly deckCards = this.deckCardsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  // Computed: Total cards in deck
  readonly totalCards = computed(() => 
    this.deckCardsSignal().reduce((sum, card) => sum + card.quantity, 0)
  );

  // Computed: Deck colors distribution
  readonly deckColors = computed(() => {
    const colors = new Set<string>();
    this.deckCardsSignal().forEach(card => {
      const cardColors = this.extractColorsFromManaCost(card.manaCost);
      cardColors.forEach(color => colors.add(color));
    });
    return Array.from(colors);
  });

  // Computed: Validation status
  readonly isValidDeck = computed(() => {
    const total = this.totalCards();
    return total === this.minDeckCards;
  });

  // Computed: Validation message
  readonly validationMessage = computed(() => {
    const total = this.totalCards();
    if (total === 0) return 'Mazo vacío';
    if (total < this.minDeckCards) return `${total}/${this.minDeckCards} cartas`;
    if (total > this.minDeckCards) return `${total}/${this.minDeckCards} cartas (excedido)`;
    return `${total} cartas`;
  });

  constructor(private http: HttpClient) {
    // Log validation changes
    effect(() => {
      console.log('Deck validation:', {
        isValid: this.isValidDeck(),
        total: this.totalCards(),
        cards: this.deckCards().length
      });
    });
  }

  /**
   * Actualiza el nombre del mazo
   */
  setDeckName(name: string): void {
    this.deckNameSignal.set(name);
  }

  /**
   * Actualiza la descripción del mazo
   */
  setDeckDescription(description: string): void {
    this.deckDescriptionSignal.set(description);
  }

  /**
   * Actualiza el formato del mazo
   */
  setDeckFormat(format: string): void {
    this.deckFormatSignal.set(format);
  }

  /**
   * Actualiza si el mazo es público
   */
  setDeckIsPublic(isPublic: boolean): void {
    this.deckIsPublicSignal.set(isPublic);
  }

  /**
   * Agrega una carta al mazo (con validación de límite de 4 copias)
   */
  addCard(card: Card, quantity: number = 1): void {
    const existing = this.deckCardsSignal().find(c => c.cardId === card.id);
    const isBasicLand = this.isBasicLandType(card.type);
    
    if (existing) {
      if (!isBasicLand && existing.quantity + quantity > 4) {
        this.errorSignal.set(`No puedes tener más de 4 copias de "${card.name}"`);
        return;
      }
      const updated = this.deckCardsSignal().map(c =>
        c.cardId === card.id ? { ...c, quantity: c.quantity + quantity } : c
      );
      this.deckCardsSignal.set(updated);
    } else {
      this.deckCardsSignal.update(cards => [
        ...cards,
        {
          cardId: card.id,
          cardName: card.name,
          cardImage: card.imageUrl,
          backCardImage: card.backImageUrl,
          doubleFaced: card.doubleFaced,
          manaCost: card.manaCost,
          cardType: card.type,
          quantity
        }
      ]);
    }
    this.errorSignal.set(null);
  }

  /**
   * Elimina una carta del mazo
   */
  removeCard(cardId: number): void {
    this.deckCardsSignal.update(cards => 
      cards.filter(c => c.cardId !== cardId)
    );
  }

  /**
   * Actualiza la cantidad de una carta
   */
  updateCardQuantity(cardId: number, quantity: number): void {
    if (quantity < 1) {
      this.removeCard(cardId);
      return;
    }
    const card = this.deckCardsSignal().find(c => c.cardId === cardId);
    if (card && !this.isBasicLandType(card.cardType) && quantity > 4) {
      this.errorSignal.set('Máximo 4 copias por carta');
      return;
    }
    this.deckCardsSignal.update(cards =>
      cards.map(c =>
        c.cardId === cardId ? { ...c, quantity } : c
      )
    );
  }

  /**
   * Limpia el mazo completo
   */
  clearDeck(): void {
    this.deckCardsSignal.set([]);
    this.deckNameSignal.set('Mi Nuevo Mazo');
    this.deckDescriptionSignal.set('');
    this.deckFormatSignal.set('STANDARD');
    this.deckIsPublicSignal.set(false);
    this.errorSignal.set(null);
  }

  /**
   * Carga un mazo existente
   */
  loadDeck(deck: Deck): void {
    this.deckNameSignal.set(deck.name);
    this.deckDescriptionSignal.set(deck.description);
    this.deckFormatSignal.set((deck.format || 'STANDARD').toUpperCase());
    this.deckIsPublicSignal.set(deck.isPublic);
    this.deckCardsSignal.set(deck.cards);
    this.errorSignal.set(null);
  }

  /**
   * Guarda el mazo en el servidor
   */
  saveDeck(deckId?: number): Observable<any> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    const deckData = {
      name: this.deckNameSignal(),
      description: this.deckDescriptionSignal(),
      format: 'STANDARD',
      isPublic: this.deckIsPublicSignal(),
      cards: this.deckCardsSignal().map(card => ({
        cardId: card.cardId,
        quantity: card.quantity
      }))
    };

    const token = localStorage.getItem('token') || '';
    if (!token) {
      this.loadingSignal.set(false);
      const error = new Error('Necesitas iniciar sesión para guardar un mazo');
      this.errorSignal.set(error.message);
      return new Observable(observer => observer.error(error));
    }
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    const request$ = deckId
      ? this.http.put(`${this.apiUrl}/${deckId}`, deckData, { headers })
      : this.http.post(this.apiUrl, deckData, { headers });

    return new Observable(observer => {
      request$.subscribe({
        next: (response) => {
          this.loadingSignal.set(false);
          observer.next(response);
          observer.complete();
        },
        error: (err) => {
          this.loadingSignal.set(false);
          const errorMsg = err.error?.message || 'Error al guardar el mazo';
          this.errorSignal.set(errorMsg);
          observer.error(err);
        }
      });
    });
  }

  /**
   * Extrae colores del costo de maná
   */
  private extractColorsFromManaCost(manaCost: string): string[] {
    const colorMap: { [key: string]: string } = {
      'W': 'white',
      'U': 'blue',
      'B': 'black',
      'R': 'red',
      'G': 'green'
    };

    const colors = new Set<string>();
    if (!manaCost) return Array.from(colors);

    // Buscar símbolos de color en el costo de maná (ej: {W}, {U}, {B}, etc)
    const matches = manaCost.match(/{([WUBRG])}/g);
    if (matches) {
      matches.forEach(match => {
        const colorCode = match.match(/([WUBRG])/)?.[1];
        if (colorCode && colorMap[colorCode]) {
          colors.add(colorMap[colorCode]);
        }
      });
    }

    return Array.from(colors);
  }

  /**
   * Obtiene los mazos del usuario
   */
  getUserDecks(): Observable<any> {
    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.get(`${this.apiUrl}/user/me`, { headers });
  }

  /**
   * Obtiene un mazo por ID
   */
  getDeckById(deckId: number): Observable<any> {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken') || '';
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.get(`${this.apiUrl}/${deckId}`, { headers });
  }

  isBasicLandType(typeLine: string): boolean {
    return (typeLine || '').toLowerCase().includes('basic land');
  }
}
