package com.magicvs.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "matches")
public class Match {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // --- JUGADORES (Relaciones con User) ---
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "player1_id", nullable = false)
    private User player1;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "player2_id")
    private User player2;

    @Column(name = "winner_id")
    private Long winnerId;

    // --- LÓGICA DE ELO (Tus campos para el motor de puntos) ---
    private int eloBeforeP1;
    private int eloBeforeP2;
    private int eloAfterP1;
    private int eloAfterP2;
    private Integer eloChange; // Diferencia neta opcional

    // --- ESTADO Y FORMATO ---
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MatchStatus status;

    private String format;
    private Integer scoreP1;
    private Integer scoreP2;

    // --- INFO DE MAZOS ---
    private String deckArchetype1;
    private String deckColors1;
    private String deckArchetype2;
    private String deckColors2;
    private Long deck1Id;
    private Long deck2Id;

    // --- ESTADO EN VIVO Y TIEMPOS ---
    @Column(columnDefinition = "TEXT")
    private String liveState;

    private LocalDateTime createdAt;
    private LocalDateTime finishedAt;

    // --- CONSTRUCTORES ---
    public Match() {}

    public Match(User player1, User player2, Long winnerId,
                 int eloBeforeP1, int eloBeforeP2,
                 int eloAfterP1, int eloAfterP2) {
        this.player1 = player1;
        this.player2 = player2;
        this.winnerId = winnerId;
        this.eloBeforeP1 = eloBeforeP1;
        this.eloBeforeP2 = eloBeforeP2;
        this.eloAfterP1 = eloAfterP1;
        this.eloAfterP2 = eloAfterP2;
        this.status = MatchStatus.FINISHED;
        this.finishedAt = LocalDateTime.now();
    }

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        if (this.status == null) {
            this.status = MatchStatus.WAITING;
        }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public User getPlayer1() { return player1; }
    public void setPlayer1(User player1) { this.player1 = player1; }

    public User getPlayer2() { return player2; }
    public void setPlayer2(User player2) { this.player2 = player2; }

    public Long getWinnerId() { return winnerId; }
    public void setWinnerId(Long winnerId) { this.winnerId = winnerId; }

    public int getEloBeforeP1() { return eloBeforeP1; }
    public void setEloBeforeP1(int eloBeforeP1) { this.eloBeforeP1 = eloBeforeP1; }

    public int getEloBeforeP2() { return eloBeforeP2; }
    public void setEloBeforeP2(int eloBeforeP2) { this.eloBeforeP2 = eloBeforeP2; }

    public int getEloAfterP1() { return eloAfterP1; }
    public void setEloAfterP1(int eloAfterP1) { this.eloAfterP1 = eloAfterP1; }

    public int getEloAfterP2() { return eloAfterP2; }
    public void setEloAfterP2(int eloAfterP2) { this.eloAfterP2 = eloAfterP2; }

    public Integer getEloChange() { return eloChange; }
    public void setEloChange(Integer eloChange) { this.eloChange = eloChange; }

    public MatchStatus getStatus() { return status; }
    public void setStatus(MatchStatus status) { this.status = status; }

    public String getFormat() { return format; }
    public void setFormat(String format) { this.format = format; }

    public Integer getScoreP1() { return scoreP1; }
    public void setScoreP1(Integer scoreP1) { this.scoreP1 = scoreP1; }

    public Integer getScoreP2() { return scoreP2; }
    public void setScoreP2(Integer scoreP2) { this.scoreP2 = scoreP2; }

    public String getDeckArchetype1() { return deckArchetype1; }
    public void setDeckArchetype1(String deckArchetype1) { this.deckArchetype1 = deckArchetype1; }

    public String getDeckColors1() { return deckColors1; }
    public void setDeckColors1(String deckColors1) { this.deckColors1 = deckColors1; }

    public String getDeckArchetype2() { return deckArchetype2; }
    public void setDeckArchetype2(String deckArchetype2) { this.deckArchetype2 = deckArchetype2; }

    public String getDeckColors2() { return deckColors2; }
    public void setDeckColors2(String deckColors2) { this.deckColors2 = deckColors2; }

    public Long getDeck1Id() { return deck1Id; }
    public void setDeck1Id(Long deck1Id) { this.deck1Id = deck1Id; }

    public Long getDeck2Id() { return deck2Id; }
    public void setDeck2Id(Long deck2Id) { this.deck2Id = deck2Id; }

    public String getLiveState() { return liveState; }
    public void setLiveState(String liveState) { this.liveState = liveState; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getFinishedAt() { return finishedAt; }
    public void setFinishedAt(LocalDateTime finishedAt) { this.finishedAt = finishedAt; }
}