package com.magicvs.backend.model;

import java.time.LocalDateTime;
import java.time.Duration;

public class QueuedPlayer {
    private final Long userId;
    private final int elo;
    private final LocalDateTime joinedAt;

    public QueuedPlayer(Long userId, int elo) {
        this.userId = userId;
        this.elo = elo;
        this.joinedAt = LocalDateTime.now();
    }

    public int getSearchRange() {
        long secondsWaiting = Duration.between(joinedAt, LocalDateTime.now()).toSeconds();
        return (int) (secondsWaiting / 10) * 100;
    }

    public Long getUserId() { return userId; }
    public int getElo() { return elo; }
    public LocalDateTime getJoinedAt() { return joinedAt; }
}