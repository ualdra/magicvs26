export interface GalleryCard {
  name: string;
  imageUrl: string;
}

export interface MetaDeck {
  id: number;
  tier: number;
  name: string;
  colorsJson: string; // Serialized string ["w", "u"]
  colors?: string[];  // Parsed for UI
  keyCardsString: string;
  presence: string;
  price: string;
  galleryJson: string; /** Json crudo devuelto por la BD para imágenes */
  gallery?: GalleryCard[]; // Parsed for UI

  /** Json crudo para la lista completa del mazo scrapeado de sub-página */
  mainboardJson?: string;
  mainboard?: any[];

  creatures?: any[];
  lands?: any[];
  spells?: any[];
  sideboard?: any[];

  creatureCount?: number;
  landCount?: number;
  spellCount?: number;
  sideboardCount?: number;

  fullListUrl: string;
  
  // UI State
  isExpanded?: boolean;
  showFullList?: boolean;
}
