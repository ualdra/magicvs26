package com.magicvs.backend.dto;
import java.util.List;

public record CardDetailDTO(
    Long id,
    String name,
    String manaCost,
    String typeLine,
    String oracleText,
    String power,
    String toughness,
    String rarity,
    String flavorText,
    String artist,
    String imageUrl,
    List<String> colors
) {}