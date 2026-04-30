package com.magicvs.backend.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "card_prices")
public class CardPrice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "card_id", nullable = false, unique = true)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private Card card;

    private BigDecimal usd;

    @Column(name = "usd_foil")
    private BigDecimal usdFoil;

    @Column(name = "usd_etched")
    private BigDecimal usdEtched;

    private BigDecimal eur;

    @Column(name = "eur_foil")
    private BigDecimal eurFoil;

    private BigDecimal tix;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public CardPrice() {
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

    public BigDecimal getUsd() {
        return usd;
    }

    public void setUsd(BigDecimal usd) {
        this.usd = usd;
    }

    public BigDecimal getUsdFoil() {
        return usdFoil;
    }

    public void setUsdFoil(BigDecimal usdFoil) {
        this.usdFoil = usdFoil;
    }

    public BigDecimal getUsdEtched() {
        return usdEtched;
    }

    public void setUsdEtched(BigDecimal usdEtched) {
        this.usdEtched = usdEtched;
    }

    public BigDecimal getEur() {
        return eur;
    }

    public void setEur(BigDecimal eur) {
        this.eur = eur;
    }

    public BigDecimal getEurFoil() {
        return eurFoil;
    }

    public void setEurFoil(BigDecimal eurFoil) {
        this.eurFoil = eurFoil;
    }

    public BigDecimal getTix() {
        return tix;
    }

    public void setTix(BigDecimal tix) {
        this.tix = tix;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}