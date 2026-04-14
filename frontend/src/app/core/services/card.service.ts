import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Card } from '../../models/card.model';

@Injectable({
  providedIn: 'root'
})
export class CardService {
  private cards: Card[] = [
    {
      id: 'elesh-norn',
      name: 'Elesh Norn, Mother of Machines',
      imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAqFVqzmY13tkBMT3gZ34MH0htUhQL_pf8Zkk2GoGh29erBZNTbJS-gJRC-iKa2IaNj8w0ytnhCHz4Lz6HUHxbC98dX1EGY8PUX7qZF5mhnExG15uRIr8quztRJW87g4t7cvTCh5yfexjKGwD7_eF2eX_k15DUUXNCEuZoebrdMMPLpXtBIdAQvPOMbXuQPpzdehK9BBHCId35rzHWMJVD0YOlWxUr80mx1gTWERd3tVqapthJG2m0TgrOFPXDy_yVFMCC5Z4CTe6KL',
      manaCost: ['4', 'W'],
      type: 'Criatura Legendaria — Pirexiano',
      rarity: 'Mythic Rare',
      oracleText: 'Vigilance\n\nIf a permanent entering the battlefield causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time.\n\nPermanents entering the battlefield don\'t cause abilities of permanents your opponents control to trigger.',
      flavorText: '"The Great Synthesis is nearly complete. My children are the gears, and I am the heart that drives them."',
      powerToughness: '4/5',
      legalities: {
        standard: 'Legal',
        pioneer: 'Legal',
        modern: 'Banned',
        commander: 'Legal'
      },
      price: 24.95
    },
    {
      id: 'lord-of-the-void',
      name: 'Lord of the Void',
      imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCW-zqLQRHf65hd_dCWktXTn3_0d5oXh8db5q-ScbHP--t_Hk-D3iFWcU_rZPG9dlbLJgdjmPyffJWqDtiuUiOIWtI7ITYCUcrrzAqxfZDwfTHgOdtneDsH72ldClr-w1NnfE63nz5_iQBnJppRk9UeVhRqpEtqoffdolQfubrLespYPWx5NJKEViK3gQ25yIHtJi7EBtdEUBlgYAjQWD34Y-wZINcfKHglyaz0F33FUXp2f14BbA1GFzitZNGOp3H-mQ60RuyCEzvy',
      manaCost: ['4', 'B', 'B', 'B'],
      type: 'Creature — Demon',
      rarity: 'Mythic Rare',
      oracleText: 'Flying\n\nWhenever Lord of the Void deals combat damage to a player, exile the top seven cards of that player\'s library, then put a creature card from among them onto the battlefield under your control.',
      legalities: {
        standard: 'Not Legal',
        pioneer: 'Legal',
        modern: 'Legal',
        commander: 'Legal'
      },
      price: 12.50
    },
    {
      id: 'primeval-growth',
      name: 'Primeval Growth',
      imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAxoEuFgb9bQbPlVpmvj59q9N0sbgceMOJaiVNeJrFQkJNTnkyo1qvwJGHIplCnIDXtYsRPLzin0sTgQn_c897Q3QsnLCzcacKbU015TGC72rsm9eWpP1V8wUXnREp0ZvghFwVqaPkELQr3IsyvUgvKsZZ13TtnA8b1ZtQRpQnOog_1OP5LMT07qiLOodfSj2MWd75z5VbcvZQ-RouVghlFYr1ih40rDol-4Umt1tVliBOFsO7HiT_FSotyIdUHmkv2MLF2rLzK9iLO',
      manaCost: ['2', 'G', 'G'],
      type: 'Sorcery',
      rarity: 'Uncommon',
      oracleText: 'Kicker—Sacrifice a creature.\n\nSearch your library for a basic land card, put it onto the battlefield, then shuffle. If this spell was kicked, search your library for two basic land cards instead of one, put them onto the battlefield, then shuffle.',
      legalities: {
        standard: 'Not Legal',
        pioneer: 'Legal',
        modern: 'Legal',
        commander: 'Legal'
      },
      price: 0.25
    }
  ];

  getCards(): Observable<Card[]> {
    return of(this.cards).pipe(delay(500)); // Simulating API delay
  }

  getCardById(id: string): Observable<Card | undefined> {
    const card = this.cards.find(c => c.id === id);
    return of(card).pipe(delay(200));
  }
}
