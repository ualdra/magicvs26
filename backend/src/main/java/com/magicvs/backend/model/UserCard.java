package com.magicvs.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_cards")
public class UserCard {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "card_id", nullable = false)
    private Card card;

    @Column(nullable = false)
    private Integer quantity = 0;

    @Column(name = "acquired_at", nullable = false)
    private LocalDateTime acquiredAt;

    public UserCard() {}

    public UserCard(User user, Card card, Integer quantity) {
        this.user = user;
        this.card = card;
        this.quantity = quantity;
    }

    @PrePersist
    protected void onCreate() {
        if (this.acquiredAt == null) {
            this.acquiredAt = LocalDateTime.now();
        }
    }

    public Long getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public Card getCard() {
        return card;
    }

    public void setCard(Card card) {
        this.card = card;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public void setQuantity(Integer quantity) {
        this.quantity = quantity;
    }

    public LocalDateTime getAcquiredAt() {
        return acquiredAt;
    }

    public void setAcquiredAt(LocalDateTime acquiredAt) {
        this.acquiredAt = acquiredAt;
    }
}
