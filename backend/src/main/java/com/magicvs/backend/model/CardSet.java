package com.magicvs.backend.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "card_sets")
public class CardSet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "scryfall_id", unique = true, nullable = false)
    private UUID scryfallId;

    @Column(nullable = false, unique = true, length = 20)
    private String code;

    @Column(nullable = false)
    private String name;

    @Column(name = "set_type")
    private String setType;

    @Column(name = "released_at")
    private LocalDate releasedAt;

    @Column(name = "card_count")
    private Integer cardCount;

    private Boolean digital;

    @Column(name = "icon_svg_uri", columnDefinition = "TEXT")
    private String iconSvgUri;

    @Column(name = "raw_json", columnDefinition = "TEXT")
    private String rawJson;

    @OneToMany(mappedBy = "set", cascade = CascadeType.ALL, orphanRemoval = false)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private List<Card> cards = new ArrayList<>();

    public CardSet() {
    }

    public Long getId() {
        return id;
    }

    public UUID getScryfallId() {
        return scryfallId;
    }

    public void setScryfallId(UUID scryfallId) {
        this.scryfallId = scryfallId;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getSetType() {
        return setType;
    }

    public void setSetType(String setType) {
        this.setType = setType;
    }

    public LocalDate getReleasedAt() {
        return releasedAt;
    }

    public void setReleasedAt(LocalDate releasedAt) {
        this.releasedAt = releasedAt;
    }

    public Integer getCardCount() {
        return cardCount;
    }

    public void setCardCount(Integer cardCount) {
        this.cardCount = cardCount;
    }

    public Boolean getDigital() {
        return digital;
    }

    public void setDigital(Boolean digital) {
        this.digital = digital;
    }

    public String getIconSvgUri() {
        return iconSvgUri;
    }

    public void setIconSvgUri(String iconSvgUri) {
        this.iconSvgUri = iconSvgUri;
    }

    public String getRawJson() {
        return rawJson;
    }

    public void setRawJson(String rawJson) {
        this.rawJson = rawJson;
    }

    public List<Card> getCards() {
        return cards;
    }

    public void setCards(List<Card> cards) {
        this.cards = cards;
    }
}