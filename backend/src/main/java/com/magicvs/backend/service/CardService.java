package com.magicvs.backend.service;

import com.magicvs.backend.dto.CardDetailDTO;
import com.magicvs.backend.dto.CardSummaryDTO;
import com.magicvs.backend.model.Card;
import com.magicvs.backend.model.CardFace;
import com.magicvs.backend.model.CardLegality;
import com.magicvs.backend.model.CardPrice;
import com.magicvs.backend.repository.CardRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class CardService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Autowired
    private CardRepository cardRepository;

    public Page<CardSummaryDTO> getCardsList(Pageable pageable) {
        return cardRepository.findAll(pageable)
                .map(card -> new CardSummaryDTO(
                        card.getId(),
                        resolveDisplayName(card.getName(), card.getRawJson()),
                        resolveDisplayType(card.getTypeLine(), card.getRawJson()),
                        card.getNormalImageUri(),
                        card.getRarity()
                ));
    }

    public Optional<CardDetailDTO> getCardDetail(Long id) {
        return cardRepository.findById(id).map(card -> {
            String normalImage = resolveNormalImage(card);
            String backImage = resolveBackImage(card);
            List<CardDetailDTO.FaceDTO> faces = mapFaces(card.getFaces());
            
            return new CardDetailDTO(
                card.getId(),
                resolveDisplayName(card.getName(), card.getRawJson()),
                card.getManaCost(),
                resolveDisplayType(card.getTypeLine(), card.getRawJson()),
                resolveDisplayOracleText(card.getOracleText(), card.getRawJson()),
                card.getPower(),
                card.getToughness(),
                card.getRarity(),
                card.getFlavorText(),
                card.getArtist(),
                normalImage,
                backImage,
                parseColors(card.getColorsJson()),
                mapLegalities(card.getLegalities()),
                mapPrice(card.getPrice()),
                card.getEdhrecRank(),
                faces,
                card.getSet() != null ? card.getSet().getName() : "Desconocido",
                card.getCollectorNumber(),
                card.getCmc() != null ? card.getCmc().doubleValue() : 0.0,
                card.getReleasedAt() != null ? card.getReleasedAt().toString() : "???"
            );
        });
    }

    private List<CardDetailDTO.FaceDTO> mapFaces(List<CardFace> faces) {
        if (faces == null || faces.isEmpty()) return List.of();
        return faces.stream()
                .map(f -> new CardDetailDTO.FaceDTO(
                    resolveDisplayName(f.getName(), f.getRawJson()),
                    f.getManaCost(),
                    resolveDisplayType(f.getTypeLine(), f.getRawJson()),
                    resolveDisplayOracleText(f.getOracleText(), f.getRawJson()),
                    f.getPower(),
                    f.getToughness(),
                    f.getFlavorText(),
                    f.getArtist(),
                    f.getNormalImageUri()
                ))
                .collect(Collectors.toList());
    }

    private String resolveNormalImage(Card card) {
        if (card.getNormalImageUri() != null && !card.getNormalImageUri().isBlank()) {
            return card.getNormalImageUri();
        }
        if (card.getFaces() != null && !card.getFaces().isEmpty()) {
            return card.getFaces().get(0).getNormalImageUri();
        }
        return null;
    }

    private String resolveBackImage(Card card) {
        if (card.getFaces() != null && card.getFaces().size() > 1) {
            return card.getFaces().get(1).getNormalImageUri();
        }
        return null;
    }

    private List<CardDetailDTO.LegalityDTO> mapLegalities(List<CardLegality> legalities) {
        if (legalities == null) return List.of();
        return legalities.stream()
                .map(l -> new CardDetailDTO.LegalityDTO(l.getFormatName(), l.getLegalityStatus()))
                .collect(Collectors.toList());
    }

    private CardDetailDTO.PriceDTO mapPrice(CardPrice price) {
        if (price == null) return null;
        return new CardDetailDTO.PriceDTO(
            price.getUsd() != null ? price.getUsd().toString() : null,
            price.getUsdFoil() != null ? price.getUsdFoil().toString() : null,
            price.getEur() != null ? price.getEur().toString() : null,
            price.getEurFoil() != null ? price.getEurFoil().toString() : null
        );
    }

    private List<String> parseColors(String colorsJson) {
        if (colorsJson == null || colorsJson.isBlank()) return List.of();
        return Arrays.asList(colorsJson.replaceAll("[\\[\\]\" ]", "").split(","));
    }

    private String resolveDisplayName(String defaultName, String rawJson) {
        String localized = extractStringFromRawJson(rawJson, "printed_name");
        return (localized != null && !localized.isBlank()) ? localized : defaultName;
    }

    private String resolveDisplayType(String defaultTypeLine, String rawJson) {
        String localized = extractStringFromRawJson(rawJson, "printed_type_line");
        if (localized != null && !localized.isBlank()) {
            return localized;
        }
        return defaultTypeLine == null ? "" : defaultTypeLine;
    }

    private String resolveDisplayOracleText(String defaultOracleText, String rawJson) {
        String localized = extractStringFromRawJson(rawJson, "printed_text");
        if (localized != null && !localized.isBlank()) {
            return localized;
        }
        return defaultOracleText == null ? "" : defaultOracleText;
    }

    private String extractStringFromRawJson(String rawJson, String field) {
        if (rawJson == null || rawJson.isBlank()) {
            return null;
        }
        try {
            JsonNode node = OBJECT_MAPPER.readTree(rawJson);
            JsonNode value = node.get(field);
            return (value != null && value.isTextual()) ? value.asText() : null;
        } catch (Exception ignored) {
            return null;
        }
    }
}