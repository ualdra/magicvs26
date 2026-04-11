package com.magicvs.backend.dto;

import java.util.List;

public class CreateDeckDTO {

    private String name;
    private String description;
    private String format;
    private Boolean isPublic;
    private List<DeckCardDTO> cards;

    public static class DeckCardDTO {
        private Long cardId;
        private Integer quantity;

        public DeckCardDTO() {
        }

        public DeckCardDTO(Long cardId, Integer quantity) {
            this.cardId = cardId;
            this.quantity = quantity;
        }

        public Long getCardId() {
            return cardId;
        }

        public void setCardId(Long cardId) {
            this.cardId = cardId;
        }

        public Integer getQuantity() {
            return quantity;
        }

        public void setQuantity(Integer quantity) {
            this.quantity = quantity;
        }
    }

    public CreateDeckDTO() {
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

    public Boolean getIsPublic() {
        return isPublic;
    }

    public void setIsPublic(Boolean aPublic) {
        isPublic = aPublic;
    }

    public List<DeckCardDTO> getCards() {
        return cards;
    }

    public void setCards(List<DeckCardDTO> cards) {
        this.cards = cards;
    }
}
