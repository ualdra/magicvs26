package com.magicvs.backend.dto;

public class ImportDeckRequestDTO {
    private String name;
    private String deckText;

    public ImportDeckRequestDTO() {
    }

    public ImportDeckRequestDTO(String name, String deckText) {
        this.name = name;
        this.deckText = deckText;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDeckText() {
        return deckText;
    }

    public void setDeckText(String deckText) {
        this.deckText = deckText;
    }
}
