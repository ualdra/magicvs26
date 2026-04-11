package com.magicvs.backend.dto;

import java.time.LocalDateTime;

public class DeckSummaryDTO {

    private Long id;
    private String name;
    private String format;
    private Integer totalCards;
    private LocalDateTime updatedAt;
    private Boolean isPublic;

    public DeckSummaryDTO() {
    }

    public DeckSummaryDTO(Long id, String name, String format, Integer totalCards, LocalDateTime updatedAt, Boolean isPublic) {
        this.id = id;
        this.name = name;
        this.format = format;
        this.totalCards = totalCards;
        this.updatedAt = updatedAt;
        this.isPublic = isPublic;
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

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Boolean getIsPublic() {
        return isPublic;
    }

    public void setIsPublic(Boolean aPublic) {
        isPublic = aPublic;
    }
}
