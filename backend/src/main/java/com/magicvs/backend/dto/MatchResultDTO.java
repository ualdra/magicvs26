package com.magicvs.backend.dto;

public class MatchResultDTO {

    private Long player1Id;
    private Long player2Id;
    private Long winnerId;

    private int eloBeforeP1;
    private int eloAfterP1;

    private int eloBeforeP2;
    private int eloAfterP2;

    public MatchResultDTO() {}

    public Long getPlayer1Id() { return player1Id; }
    public void setPlayer1Id(Long player1Id) { this.player1Id = player1Id; }

    public Long getPlayer2Id() { return player2Id; }
    public void setPlayer2Id(Long player2Id) { this.player2Id = player2Id; }

    public Long getWinnerId() { return winnerId; }
    public void setWinnerId(Long winnerId) { this.winnerId = winnerId; }

    public int getEloBeforeP1() { return eloBeforeP1; }
    public void setEloBeforeP1(int eloBeforeP1) { this.eloBeforeP1 = eloBeforeP1; }

    public int getEloAfterP1() { return eloAfterP1; }
    public void setEloAfterP1(int eloAfterP1) { this.eloAfterP1 = eloAfterP1; }

    public int getEloBeforeP2() { return eloBeforeP2; }
    public void setEloBeforeP2(int eloBeforeP2) { this.eloBeforeP2 = eloBeforeP2; }

    public int getEloAfterP2() { return eloAfterP2; }
    public void setEloAfterP2(int eloAfterP2) { this.eloAfterP2 = eloAfterP2; }
}