package com.magicvs.backend.model;

import java.time.LocalDateTime;
import java.time.Duration;
import lombok.Getter;

@Getter
public class QueuedPlayer {
    private final Long userId;
    private final int elo;
    private final Long deckId; // Añadido para que la batalla funcione
    private final LocalDateTime joinedAt;

    public QueuedPlayer(Long userId, int elo, Long deckId) {
        this.userId = userId;
        this.elo = elo;
        this.deckId = deckId;
        this.joinedAt = LocalDateTime.now();
    }

    public int getSearchRange() {
        long secondsWaiting = Duration.between(joinedAt, LocalDateTime.now()).toSeconds();
        return (int) (secondsWaiting / 10) * 100;
    }
}