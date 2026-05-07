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

    // Traducciones de frases completas para respetar género y gramática (ej: Legendaria vs Legendario)
    private static final java.util.Map<String, String> EXACT_TYPE_PHRASES = java.util.Map.ofEntries(
        java.util.Map.entry("Legendary Creature", "Criatura legendaria"),
        java.util.Map.entry("Legendary Artifact Creature", "Criatura artefacto legendaria"),
        java.util.Map.entry("Legendary Enchantment Creature", "Criatura encantamiento legendaria"),
        java.util.Map.entry("Legendary Artifact", "Artefacto legendario"),
        java.util.Map.entry("Legendary Land", "Tierra legendaria"),
        java.util.Map.entry("Legendary Planeswalker", "Planeswalker legendario"),
        java.util.Map.entry("Legendary Enchantment", "Encantamiento legendario"),
        java.util.Map.entry("Artifact Creature", "Criatura artefacto"),
        java.util.Map.entry("Enchantment Creature", "Criatura encantamiento"),
        java.util.Map.entry("Basic Land", "Tierra básica"),
        java.util.Map.entry("Snow Land", "Tierra nevada"),
        java.util.Map.entry("Snow Creature", "Criatura nevada"),
        java.util.Map.entry("Token Creature", "Ficha de Criatura"),
        java.util.Map.entry("Token Artifact", "Ficha de Artefacto"),
        // Subtipos con orden específico en español
        java.util.Map.entry("Human Avatar Ally", "Avatar humano aliado"),
        java.util.Map.entry("Djinn Sorcerer", "Mago djinn"),
        java.util.Map.entry("Bird Bard", "Bardo ave")
    );

    // Traducciones palabra por palabra como respaldo final
    private static final java.util.Map<String, String> WORD_TRANSLATIONS = java.util.Map.ofEntries(
        java.util.Map.entry("Creature", "Criatura"),
        java.util.Map.entry("Instant", "Instantáneo"),
        java.util.Map.entry("Sorcery", "Conjuro"),
        java.util.Map.entry("Enchantment", "Encantamiento"),
        java.util.Map.entry("Artifact", "Artefacto"),
        java.util.Map.entry("Planeswalker", "Planeswalker"),
        java.util.Map.entry("Land", "Tierra"),
        java.util.Map.entry("Battle", "Batalla"),
        java.util.Map.entry("Human", "Humano"),
        java.util.Map.entry("Elf", "Elfo"),
        java.util.Map.entry("Zombie", "Zombi"),
        java.util.Map.entry("Dragon", "Dragón"),
        java.util.Map.entry("Warrior", "Guerrero"),
        java.util.Map.entry("Soldier", "Soldado"),
        java.util.Map.entry("Wizard", "Hechicero"),
        java.util.Map.entry("Sorcerer", "Mago"),
        java.util.Map.entry("Knight", "Caballero"),
        java.util.Map.entry("Cleric", "Clérigo"),
        java.util.Map.entry("Spirit", "Espíritu"),
        java.util.Map.entry("Lesson", "Lección"),
        java.util.Map.entry("Ally", "Aliado"),
        java.util.Map.entry("Equipment", "Equipo"),
        java.util.Map.entry("Aura", "Aura"),
        java.util.Map.entry("Vehicle", "Vehículo"),
        java.util.Map.entry("Saga", "Saga"),
        java.util.Map.entry("Vampire", "Vampiro"),
        java.util.Map.entry("Goblin", "Trasgo"),
        java.util.Map.entry("Merfolk", "Tritón"),
        java.util.Map.entry("Beast", "Bestia"),
        java.util.Map.entry("Elemental", "Elemental"),
        java.util.Map.entry("Angel", "Ángel"),
        java.util.Map.entry("Demon", "Demonio"),
        java.util.Map.entry("Horror", "Horror"),
        java.util.Map.entry("Rogue", "Pícaro"),
        java.util.Map.entry("Bird", "Ave"),
        java.util.Map.entry("Bard", "Bardo"),
        java.util.Map.entry("Djinn", "Djinn"),
        java.util.Map.entry("Dog", "Perro"),
        java.util.Map.entry("Cat", "Gato"),
        java.util.Map.entry("Bear", "Oso"),
        java.util.Map.entry("Dinosaur", "Dinosaurio"),
        java.util.Map.entry("Sphinx", "Esfinge"),
        java.util.Map.entry("Hydra", "Hidra"),
        java.util.Map.entry("Giant", "Gigante"),
        java.util.Map.entry("Shapeshifter", "Metamorfo"),
        java.util.Map.entry("Artificer", "Artífice"),
        java.util.Map.entry("Scout", "Explorador"),
        java.util.Map.entry("Druid", "Druida"),
        java.util.Map.entry("Shaman", "Chamán"),
        java.util.Map.entry("Monk", "Monje"),
        java.util.Map.entry("Warlock", "Brujo"),
        java.util.Map.entry("Assassin", "Asesino"),
        java.util.Map.entry("Ninja", "Ninja"),
        java.util.Map.entry("Samurai", "Samurái"),
        java.util.Map.entry("Pirate", "Pirata"),
        java.util.Map.entry("Mercenary", "Mercenario"),
        java.util.Map.entry("Construct", "Constructo"),
        java.util.Map.entry("Golem", "Gólem"),
        java.util.Map.entry("Illusion", "Ilusión"),
        java.util.Map.entry("Nightmare", "Pesadilla"),
        java.util.Map.entry("Insect", "Insecto"),
        java.util.Map.entry("Spider", "Araña"),
        java.util.Map.entry("Wurm", "Sierpe"),
        java.util.Map.entry("Ooze", "Cieno"),
        java.util.Map.entry("Plant", "Planta"),
        java.util.Map.entry("Treefolk", "Ent"),
        java.util.Map.entry("Fungus", "Hongo"),
        java.util.Map.entry("Eldrazi", "Eldrazi"),
        java.util.Map.entry("Phyrexian", "Pirexiano"),
        java.util.Map.entry("Sliver", "Fragmentado"),
        java.util.Map.entry("God", "Dios"),
        java.util.Map.entry("Demigod", "Semidiós"),
        java.util.Map.entry("Eye", "Ojo"),
        java.util.Map.entry("Plains", "Llanura"),
        java.util.Map.entry("Island", "Isla"),
        java.util.Map.entry("Swamp", "Pantano"),
        java.util.Map.entry("Mountain", "Montaña"),
        java.util.Map.entry("Forest", "Bosque"),
        java.util.Map.entry("Adventure", "Aventura"),
        java.util.Map.entry("Arcane", "Arcano"),
        java.util.Map.entry("Trap", "Trampa"),
        java.util.Map.entry("Curse", "Maldición"),
        java.util.Map.entry("Shrine", "Santuario")
    );

    private static final java.util.Map<String, String> RARITY_TRANSLATIONS = java.util.Map.of(
        "common", "Común",
        "uncommon", "Infrecuente",
        "rare", "Rara",
        "mythic", "Mítica",
        "special", "Especial",
        "bonus", "Bonus"
    );

    public Page<CardSummaryDTO> getCardsList(Pageable pageable) {
        return cardRepository.findAll(pageable)
                .map(card -> new CardSummaryDTO(
                        card.getId(),
                        card.getScryfallId(),
                        resolveDisplayName(card.getName(), card.getRawJson()),
                        resolveDisplayType(card.getTypeLine(), card.getRawJson()),
                        card.getNormalImageUri(),
                        resolveDisplayRarity(card.getRarity())
                ));
    }

    public Optional<CardDetailDTO> getCardDetail(Long id) {
        return cardRepository.findById(id).map(card -> {
            String normalImage = resolveNormalImage(card);
            String backImage = resolveBackImage(card);
            List<CardDetailDTO.FaceDTO> faces = mapFaces(card.getFaces());
            
            return new CardDetailDTO(
                card.getId(),
                card.getScryfallId(),
                resolveDisplayName(card.getName(), card.getRawJson()),
                card.getManaCost(),
                resolveDisplayType(card.getTypeLine(), card.getRawJson()),
                resolveDisplayOracleText(card.getOracleText(), card.getRawJson()),
                card.getPower(),
                card.getToughness(),
                resolveDisplayRarity(card.getRarity()),
                resolveDisplayFlavorText(card.getFlavorText(), card.getRawJson()),
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
                    resolveDisplayFlavorText(f.getFlavorText(), f.getRawJson()),
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
                .map(l -> {
                    String status = l.getLegalityStatus();
                    if ("legal".equalsIgnoreCase(status)) status = "Legal";
                    else if ("banned".equalsIgnoreCase(status)) status = "Prohibida";
                    else if ("not_legal".equalsIgnoreCase(status)) status = "No legal";
                    else if ("restricted".equalsIgnoreCase(status)) status = "Restringida";
                    
                    return new CardDetailDTO.LegalityDTO(l.getFormatName().toUpperCase(), status);
                })
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

    public String resolveDisplayName(String defaultName, String rawJson) {
        String localized = extractStringFromRawJson(rawJson, "printed_name");
        return (localized != null && !localized.isBlank()) ? localized : defaultName;
    }

    public String resolveDisplayType(String defaultTypeLine, String rawJson) {
        String localized = extractStringFromRawJson(rawJson, "printed_type_line");
        if (localized != null && !localized.isBlank()) {
            return localized;
        }
        if (defaultTypeLine == null || defaultTypeLine.isBlank()) return "";
        
        // Split supertypes/types and subtypes by the em-dash or standard dash
        String[] parts = defaultTypeLine.split(" — | - ");
        StringBuilder translatedLine = new StringBuilder();

        for (int i = 0; i < parts.length; i++) {
            String part = parts[i].trim();
            
            // 1. Try exact phrase match first (e.g., "Legendary Creature" -> "Criatura legendaria")
            String translatedPart = EXACT_TYPE_PHRASES.get(part);
            
            if (translatedPart == null) {
                // Si estamos en la parte de los subtipos (después del guion) y no hay coincidencia exacta,
                // invertimos el orden de las palabras. La gramática inglesa es [Raza] [Clase], 
                // mientras que en español es [Clase] [Raza]. (Ej: "Eye Horror" -> "Horror Ojo").
                if (i > 0) {
                    String[] words = part.split("\\s+");
                    if (words.length > 1) {
                        StringBuilder reversed = new StringBuilder();
                        for (int j = words.length - 1; j >= 0; j--) {
                            reversed.append(words[j]);
                            if (j > 0) reversed.append(" ");
                        }
                        part = reversed.toString();
                    }
                }

                // 2. If no exact match, fallback to word-by-word translation
                translatedPart = part;
                for (java.util.Map.Entry<String, String> entry : WORD_TRANSLATIONS.entrySet()) {
                    // Usamos word boundaries regex \b para no reemplazar subcadenas accidentalmente
                    translatedPart = translatedPart.replaceAll("(?i)\\b" + entry.getKey() + "\\b", entry.getValue());
                }
            }
            
            translatedLine.append(translatedPart);
            if (i < parts.length - 1) {
                translatedLine.append(" — ");
            }
        }
        
        return translatedLine.toString();
    }

    public String resolveDisplayOracleText(String defaultOracleText, String rawJson) {
        String localized = extractStringFromRawJson(rawJson, "printed_text");
        if (localized != null && !localized.isBlank()) {
            return localized;
        }
        return defaultOracleText == null ? "" : defaultOracleText;
    }

    public String resolveDisplayFlavorText(String defaultFlavorText, String rawJson) {
        String localized = extractStringFromRawJson(rawJson, "printed_flavor_text");
        if (localized != null && !localized.isBlank()) {
            return localized;
        }
        return defaultFlavorText == null ? "" : defaultFlavorText;
    }

    public String resolveDisplayRarity(String rarity) {
        if (rarity == null) return "";
        return RARITY_TRANSLATIONS.getOrDefault(rarity.toLowerCase(), rarity.substring(0, 1).toUpperCase() + rarity.substring(1).toLowerCase());
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