package com.magicvs.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "matches")
public class Match {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "player1_id", nullable = false)
    private User player1;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "player2_id")
    private User player2;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MatchStatus status;

    @Column(length = 50)
    private String format;

    @Column(name = "winner_id")
    private Long winnerId;

    @Column(name = "score_p1")
    private Integer scoreP1;

    @Column(name = "score_p2")
    private Integer scoreP2;

    @Column(name = "elo_change")
    private Integer eloChange;

    @Column(name = "deck_archetype1")
    private String deckArchetype1;

    @Column(name = "deck_colors1")
    private String deckColors1;

    @Column(name = "deck_archetype2")
    private String deckArchetype2;

    @Column(name = "deck_colors2")
    private String deckColors2;

    @Column(name = "deck1_id")
    private Long deck1Id;

    @Column(name = "deck2_id")
    private Long deck2Id;

    @Column(name = "live_state", columnDefinition = "TEXT")
    private String liveState;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "finished_at")
    private LocalDateTime finishedAt;

    public Match() {
    }

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        if (this.status == null) {
            this.status = MatchStatus.WAITING;
        }
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public User getPlayer1() {
        return player1;
    }

    public void setPlayer1(User player1) {
        this.player1 = player1;
    }

    public User getPlayer2() {
        return player2;
    }

    public void setPlayer2(User player2) {
        this.player2 = player2;
    }

    public MatchStatus getStatus() {
        return status;
    }

    public void setStatus(MatchStatus status) {
        this.status = status;
    }

    public String getFormat() {
        return format;
    }

    public void setFormat(String format) {
        this.format = format;
    }

    public Long getWinnerId() {
        return winnerId;
    }

    public void setWinnerId(Long winnerId) {
        this.winnerId = winnerId;
    }

    public Integer getScoreP1() {
        return scoreP1;
    }

    public void setScoreP1(Integer scoreP1) {
        this.scoreP1 = scoreP1;
    }

    public Integer getScoreP2() {
        return scoreP2;
    }

    public void setScoreP2(Integer scoreP2) {
        this.scoreP2 = scoreP2;
    }

    public Integer getEloChange() {
        return eloChange;
    }

    public void setEloChange(Integer eloChange) {
        this.eloChange = eloChange;
    }

    public String getDeckArchetype1() {
        return deckArchetype1;
    }

    public void setDeckArchetype1(String deckArchetype1) {
        this.deckArchetype1 = deckArchetype1;
    }

    public String getDeckColors1() {
        return deckColors1;
    }

    public void setDeckColors1(String deckColors1) {
        this.deckColors1 = deckColors1;
    }

    public String getDeckArchetype2() {
        return deckArchetype2;
    }

    public void setDeckArchetype2(String deckArchetype2) {
        this.deckArchetype2 = deckArchetype2;
    }

    public String getDeckColors2() {
        return deckColors2;
    }

    public void setDeckColors2(String deckColors2) {
        this.deckColors2 = deckColors2;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getFinishedAt() {
        return finishedAt;
    }

    public void setFinishedAt(LocalDateTime finishedAt) {
        this.finishedAt = finishedAt;
    }

    public Long getDeck1Id() {
        return deck1Id;
    }

    public void setDeck1Id(Long deck1Id) {
        this.deck1Id = deck1Id;
    }

    public Long getDeck2Id() {
        return deck2Id;
    }

    public void setDeck2Id(Long deck2Id) {
        this.deck2Id = deck2Id;
    }

    public String getLiveState() {
        return liveState;
    }

    public void setLiveState(String liveState) {
        this.liveState = liveState;
    }
}
