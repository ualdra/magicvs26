export interface Card {
  id: string;
  name: string;
  imageUrl: string;
  imageUrl2: string;
  manaCost: string[];
  type: string;
  rarity: string;
  oracleText: string;
  flavorText?: string;
  powerToughness?: string;
  legalities: {
    standard: 'Legal' | 'Banned' | 'Not Legal';
    pioneer: 'Legal' | 'Banned' | 'Not Legal';
    modern: 'Legal' | 'Banned' | 'Not Legal';
    commander: 'Legal' | 'Banned' | 'Not Legal';
  };
  price: number;
}
