package com.magicvs.backend.dto;

import java.util.List;

public class MatchHistoryDto {
    private Long id;
    private PlayerDto player1;
    private PlayerDto player2;
    private String winner; 
    private String score;
    private Integer eloChange;
    private String format;
    private String timestamp;
    private DeckSummaryDto deck1;
    private DeckSummaryDto deck2;

    public static class PlayerDto {
        public String username;
        public String avatarUrl;

        public PlayerDto(String username, String avatarUrl) {
            this.username = username;
            this.avatarUrl = avatarUrl;
        }
    }

    public static class DeckSummaryDto {
        public String archetype;
        public List<String> colors;

        public DeckSummaryDto(String archetype, List<String> colors) {
            this.archetype = archetype;
            this.colors = colors;
        }
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public PlayerDto getPlayer1() { return player1; }
    public void setPlayer1(PlayerDto player1) { this.player1 = player1; }
    public PlayerDto getPlayer2() { return player2; }
    public void setPlayer2(PlayerDto player2) { this.player2 = player2; }
    public String getWinner() { return winner; }
    public void setWinner(String winner) { this.winner = winner; }
    public String getScore() { return score; }
    public void setScore(String score) { this.score = score; }
    public Integer getEloChange() { return eloChange; }
    public void setEloChange(Integer eloChange) { this.eloChange = eloChange; }
    public String getFormat() { return format; }
    public void setFormat(String format) { this.format = format; }
    public String getTimestamp() { return timestamp; }
    public void setTimestamp(String timestamp) { this.timestamp = timestamp; }
    public DeckSummaryDto getDeck1() { return deck1; }
    public void setDeck1(DeckSummaryDto deck1) { this.deck1 = deck1; }
    public DeckSummaryDto getDeck2() { return deck2; }
    public void setDeck2(DeckSummaryDto deck2) { this.deck2 = deck2; }
}
