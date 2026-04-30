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
    String normalImageUri,
    String backImageUri,
    List<String> colors,
    List<LegalityDTO> legalities,
    PriceDTO price,
    Integer edhrecRank,
    List<FaceDTO> faces,
    String setName,
    String collectorNumber,
    Double cmc,
    String releasedAt
) {
    public record LegalityDTO(String formatName, String legalityStatus) {}
    public record PriceDTO(String usd, String usdFoil, String eur, String eurFoil) {}
    public record FaceDTO(
        String name,
        String manaCost,
        String typeLine,
        String oracleText,
        String power,
        String toughness,
        String flavorText,
        String artist,
        String normalImageUri
    ) {}
}