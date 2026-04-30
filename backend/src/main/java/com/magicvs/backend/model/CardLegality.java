package com.magicvs.backend.model;

import jakarta.persistence.*;

@Entity
@Table(name = "card_legalities")
public class CardLegality {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "card_id", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private Card card;

    @Column(name = "format_name", nullable = false)
    private String formatName;

    @Column(name = "legality_status", nullable = false)
    private String legalityStatus;

    public CardLegality() {
    }

    public Long getId() {
        return id;
    }

    public Card getCard() {
        return card;
    }

    public void setCard(Card card) {
        this.card = card;
    }

    public String getFormatName() {
        return formatName;
    }

    public void setFormatName(String formatName) {
        this.formatName = formatName;
    }

    public String getLegalityStatus() {
        return legalityStatus;
    }

    public void setLegalityStatus(String legalityStatus) {
        this.legalityStatus = legalityStatus;
    }
}