export interface CardSummary {
  id: number;
  scryfallId: string;
  name: string;
  typeLine: string;
  imageUrl: string;
  rarity: string;
}

export interface UserCard extends CardSummary {
  quantity: number;
}
