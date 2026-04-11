package com.magicvs.backend.model;

public enum DeckFormat {
    STANDARD("Standard"),
    MODERN("Modern"),
    LEGACY("Legacy"),
    PAUPER("Pauper");

    private final String displayName;

    DeckFormat(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}
