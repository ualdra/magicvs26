package com.magicvs.backend.dto;

public record CardSummaryDTO(
    Long id,
    java.util.UUID scryfallId,
    String name,
    String typeLine,
    String imageUrl,
    String rarity
) {}