package com.magicvs.backend.dto;

public record CardSummaryDTO(
    Long id,
    String name,
    String typeLine,
    String imageUrl,
    String rarity
) {}