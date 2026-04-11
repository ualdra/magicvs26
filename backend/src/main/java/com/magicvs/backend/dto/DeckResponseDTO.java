package com.magicvs.backend.dto;

import com.magicvs.backend.model.Deck;
import com.magicvs.backend.model.DeckCard;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

public class DeckResponseDTO {

    private Long id;
    private String name;
    private String description;
    private String format;
    private Integer totalCards;
    private Boolean isPublic;
    private List<DeckCardResponseDTO> cards;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static class DeckCardResponseDTO {
        private Long cardId;
        private String cardName;
        private String cardImage;
        private String manaCost;
        private String cardType;
        private Integer quantity;

        public DeckCardResponseDTO() {
        }

        public DeckCardResponseDTO(Long cardId, String cardName, String cardImage, String manaCost, String cardType, Integer quantity) {
            this.cardId = cardId;
            this.cardName = cardName;
            this.cardImage = cardImage;
            this.manaCost = manaCost;
            this.cardType = cardType;
            this.quantity = quantity;
        }

        public Long getCardId() {
            return cardId;
        }

        public void setCardId(Long cardId) {
            this.cardId = cardId;
        }

        public String getCardName() {
            return cardName;
        }

        public void setCardName(String cardName) {
            this.cardName = cardName;
        }

        public String getCardImage() {
            return cardImage;
        }

        public void setCardImage(String cardImage) {
            this.cardImage = cardImage;
        }

        public String getManaCost() {
            return manaCost;
        }

        public void setManaCost(String manaCost) {
            this.manaCost = manaCost;
        }

        public String getCardType() {
            return cardType;
        }

        public void setCardType(String cardType) {
            this.cardType = cardType;
        }

        public Integer getQuantity() {
            return quantity;
        }

        public void setQuantity(Integer quantity) {
            this.quantity = quantity;
        }
    }

    public DeckResponseDTO() {
    }

    /**
     * Convierte una entidad Deck a DeckResponseDTO
     */
    public static DeckResponseDTO fromEntity(Deck deck) {
        DeckResponseDTO dto = new DeckResponseDTO();
        dto.setId(deck.getId());
        dto.setName(deck.getName());
        dto.setDescription(deck.getDescription());
        dto.setFormat(deck.getFormat().name());
        dto.setTotalCards(deck.getTotalCards());
        dto.setIsPublic(deck.getPublic());
        dto.setCreatedAt(deck.getCreatedAt());
        dto.setUpdatedAt(deck.getUpdatedAt());
        
        List<DeckCardResponseDTO> cardDtos = deck.getCards().stream()
            .map(deckCard -> {
                String imageUrl = deckCard.getCard().getFaces().isEmpty() 
                    ? null 
                    : deckCard.getCard().getFaces().get(0).getNormalImageUri();
                
                return new DeckCardResponseDTO(
                    deckCard.getCard().getId(),
                    deckCard.getCard().getName(),
                    imageUrl,
                    deckCard.getCard().getManaCost(),
                    deckCard.getCard().getTypeLine(),
                    deckCard.getQuantity()
                );
            })
            .collect(Collectors.toList());
        
        dto.setCards(cardDtos);
        return dto;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getFormat() {
        return format;
    }

    public void setFormat(String format) {
        this.format = format;
    }

    public Integer getTotalCards() {
        return totalCards;
    }

    public void setTotalCards(Integer totalCards) {
        this.totalCards = totalCards;
    }

    public Boolean getIsPublic() {
        return isPublic;
    }

    public void setIsPublic(Boolean aPublic) {
        isPublic = aPublic;
    }

    public List<DeckCardResponseDTO> getCards() {
        return cards;
    }

    public void setCards(List<DeckCardResponseDTO> cards) {
        this.cards = cards;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
