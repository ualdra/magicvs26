package com.magicvs.backend.dto;

public class CreateMatchDTO {

    private Long player1Id;
    private Long player2Id;
    private Long winnerId;

    public CreateMatchDTO() {}

    public Long getPlayer1Id() { return player1Id; }
    public void setPlayer1Id(Long player1Id) { this.player1Id = player1Id; }

    public Long getPlayer2Id() { return player2Id; }
    public void setPlayer2Id(Long player2Id) { this.player2Id = player2Id; }

    public Long getWinnerId() { return winnerId; }
    public void setWinnerId(Long winnerId) { this.winnerId = winnerId; }
}