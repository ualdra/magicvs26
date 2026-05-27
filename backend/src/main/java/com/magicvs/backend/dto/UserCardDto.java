package com.magicvs.backend.dto;

import java.util.UUID;

public record UserCardDto(
    Long id,
    UUID scryfallId,
    String name,
    String typeLine,
    String imageUrl,
    String rarity,
    Integer quantity
) {}
