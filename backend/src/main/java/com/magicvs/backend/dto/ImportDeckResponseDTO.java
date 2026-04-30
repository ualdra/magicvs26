package com.magicvs.backend.dto;

import java.util.List;

public class ImportDeckResponseDTO {
    private DeckResponseDTO deck;
    private List<String> missingCards;

    public ImportDeckResponseDTO() {}

    public ImportDeckResponseDTO(DeckResponseDTO deck, List<String> missingCards) {
        this.deck = deck;
        this.missingCards = missingCards;
    }

    public DeckResponseDTO getDeck() {
        return deck;
    }

    public void setDeck(DeckResponseDTO deck) {
        this.deck = deck;
    }

    public List<String> getMissingCards() {
        return missingCards;
    }

    public void setMissingCards(List<String> missingCards) {
        this.missingCards = missingCards;
    }
}
