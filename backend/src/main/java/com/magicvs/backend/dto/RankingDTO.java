package com.magicvs.backend.dto;

public class RankingDTO {

    private String username;
    private int elo;
    private int position;

    public RankingDTO() {}

    public RankingDTO(String username, int elo, int position) {
        this.username = username;
        this.elo = elo;
        this.position = position;
    }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public int getElo() { return elo; }
    public void setElo(int elo) { this.elo = elo; }

    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }
}