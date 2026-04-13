package com.magicvs.backend.model;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "rulings")
public class Ruling {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "card_id", nullable = false)
    private Card card;

    private String source;

    @Column(name = "published_at")
    private LocalDate publishedAt;

    @Column(columnDefinition = "TEXT")
    private String comment;

    @Column(name = "raw_json", columnDefinition = "TEXT")
    private String rawJson;

    public Ruling() {
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

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public LocalDate getPublishedAt() {
        return publishedAt;
    }

    public void setPublishedAt(LocalDate publishedAt) {
        this.publishedAt = publishedAt;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public String getRawJson() {
        return rawJson;
    }

    public void setRawJson(String rawJson) {
        this.rawJson = rawJson;
    }
}