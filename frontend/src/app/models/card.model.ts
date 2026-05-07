export interface CardFace {
  name: string;
  manaCost: string[];
  type: string;
  oracleText: string;
  powerToughness?: string;
  flavorText?: string;
  imageUrl: string;
}

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
    [key: string]: string | undefined;
    standard: string;
    pioneer: string;
    modern: string;
    commander: string;
  };
  price: number;
  edhrecRank?: number;
  faces?: CardFace[];
  setName?: string;
  collectorNumber?: string;
  cmc?: number;
  releasedAt?: string;
  artist?: string;
}
