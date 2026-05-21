package com.magicvs.backend.service;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.magicvs.backend.model.*;
import com.magicvs.backend.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import java.net.URI;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class ScryfallService {

    private static final Logger logger = LoggerFactory.getLogger(ScryfallService.class);
    private static final String SCRYFALL_API_BASE = "https://api.scryfall.com";

    @Autowired
    private RestTemplate restTemplate;

    @Autowired
    private CardRepository cardRepository;

    @Autowired
    private CardSetRepository cardSetRepository;

    @Autowired
    private CardFaceRepository cardFaceRepository;

    @Autowired
    private CardLegalityRepository cardLegalityRepository;

    @Autowired
    private CardPriceRepository cardPriceRepository;

    @Autowired
    private RulingRepository rulingRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Importa todas las cartas del formato Standard actual.
     */
    @Transactional
    public int importStandardCards() {
        String url = SCRYFALL_API_BASE + "/cards/search?q=f:standard+lang:es";
        return fetchAndSaveAll(url);
    }

    /**
     * Importa una carta por su nombre.
     */
    @Transactional
    public Card importCardByName(String name, boolean onlyStandard) {
        String query = name;
        if (onlyStandard) {
            query += " f:standard";
        }
        String url = SCRYFALL_API_BASE + "/cards/named?fuzzy=" + query;
        try {
            JsonNode root = restTemplate.getForObject(url, JsonNode.class);
            if (root != null) {
                return saveOrUpdateCard(root);
            }
        } catch (Exception e) {
            logger.error("Error al importar carta por nombre: {}", name, e);
        }
        return null;
    }

    /**
     * Importa todas las cartas de una expansión específica.
     */
    @Transactional
    public int importCardsBySet(String setCode, boolean onlyStandard) {
        String query = "set:" + setCode;
        if (onlyStandard) {
            query += " f:standard";
        }
        String url = SCRYFALL_API_BASE + "/cards/search?q=" + query;
        return fetchAndSaveAll(url);
    }

    private int fetchAndSaveAll(String initialUrl) {
        int count = 0;
        String nextUrl = initialUrl;

        while (nextUrl != null) {
            try {
                logger.info("Fetching cards from: {}", nextUrl);
                JsonNode response = restTemplate.getForObject(URI.create(nextUrl), JsonNode.class);
                if (response == null || !response.has("data")) {
                    break;
                }

                JsonNode data = response.get("data");
                for (JsonNode cardNode : data) {
                    saveOrUpdateCard(cardNode);
                    count++;
                }

                if (response.has("has_more") && response.get("has_more").asBoolean()) {
                    nextUrl = response.get("next_page").asText();
                    // Rate limiting: Scryfall agradece 100ms entre peticiones
                    Thread.sleep(100);
                } else {
                    nextUrl = null;
                }
            } catch (Exception e) {
                logger.error("Error durante la importación masiva", e);
                break;
            }
        }
        return count;
    }

    private Card saveOrUpdateCard(JsonNode node) {
        UUID scryfallId = UUID.fromString(node.get("id").asText());
        Card card = cardRepository.findByScryfallId(scryfallId).orElse(new Card());

        card.setScryfallId(scryfallId);
        card.setOracleId(node.has("oracle_id") ? UUID.fromString(node.get("oracle_id").asText()) : null);
        card.setName(node.get("name").asText());
        card.setLang(node.has("lang") ? node.get("lang").asText() : "en");
        card.setReleasedAt(node.has("released_at") ? LocalDate.parse(node.get("released_at").asText()) : null);
        card.setLayout(node.has("layout") ? node.get("layout").asText() : null);
        card.setManaCost(node.has("mana_cost") ? node.get("mana_cost").asText() : null);
        card.setCmc(node.has("cmc") ? new BigDecimal(node.get("cmc").asText()) : BigDecimal.ZERO);
        card.setTypeLine(node.has("type_line") ? node.get("type_line").asText() : null);
        card.setOracleText(node.has("oracle_text") ? node.get("oracle_text").asText() : null);
        card.setPower(node.has("power") ? node.get("power").asText() : null);
        card.setToughness(node.has("toughness") ? node.get("toughness").asText() : null);
        card.setLoyalty(node.has("loyalty") ? node.get("loyalty").asText() : null);
        card.setDefense(node.has("defense") ? node.get("defense").asText() : null);
        card.setCollectorNumber(node.get("collector_number").asText());
        card.setRarity(node.get("rarity").asText());
        card.setFlavorText(node.has("flavor_text") ? node.get("flavor_text").asText() : null);
        card.setArtist(node.has("artist") ? node.get("artist").asText() : null);
        card.setReserved(node.has("reserved") ? node.get("reserved").asBoolean() : false);
        card.setReprint(node.has("reprint") ? node.get("reprint").asBoolean() : false);
        card.setDigital(node.has("digital") ? node.get("digital").asBoolean() : false);
        card.setFoil(node.has("foil") ? node.get("foil").asBoolean() : true);
        card.setNonfoil(node.has("nonfoil") ? node.get("nonfoil").asBoolean() : true);
        card.setPromo(node.has("promo") ? node.get("promo").asBoolean() : false);
        card.setFullArt(node.has("full_art") ? node.get("full_art").asBoolean() : false);
        card.setTextless(node.has("textless") ? node.get("textless").asBoolean() : false);
        card.setScryfallUri(node.has("scryfall_uri") ? node.get("scryfall_uri").asText() : null);
        card.setPrintsSearchUri(node.has("prints_search_uri") ? node.get("prints_search_uri").asText() : null);
        card.setRulingsUri(node.has("rulings_uri") ? node.get("rulings_uri").asText() : null);

        // IDs externos
        card.setArenaId(node.has("arena_id") ? node.get("arena_id").asInt() : null);
        card.setMtgoId(node.has("mtgo_id") ? node.get("mtgo_id").asInt() : null);
        card.setTcgplayerId(node.has("tcgplayer_id") ? node.get("tcgplayer_id").asInt() : null);
        card.setCardmarketId(node.has("cardmarket_id") ? node.get("cardmarket_id").asInt() : null);
        card.setEdhrecRank(node.has("edhrec_rank") ? node.get("edhrec_rank").asInt() : null);

        // Imágenes para cartas de una sola cara
        if (node.has("image_uris")) {
            JsonNode images = node.get("image_uris");
            card.setSmallImageUri(images.has("small") ? images.get("small").asText() : null);
            card.setNormalImageUri(images.has("normal") ? images.get("normal").asText() : null);
            card.setLargeImageUri(images.has("large") ? images.get("large").asText() : null);
            card.setPngImageUri(images.has("png") ? images.get("png").asText() : null);
            card.setArtCropUri(images.has("art_crop") ? images.get("art_crop").asText() : null);
            card.setBorderCropUri(images.has("border_crop") ? images.get("border_crop").asText() : null);
        }

        // Datos JSON
        card.setColorsJson(node.has("colors") ? node.get("colors").toString() : "[]");
        card.setColorIdentityJson(node.has("color_identity") ? node.get("color_identity").toString() : "[]");
        card.setGamesJson(node.has("games") ? node.get("games").toString() : "[]");
        card.setKeywordsJson(node.has("keywords") ? node.get("keywords").toString() : "[]");
        card.setProducedManaJson(node.has("produced_mana") ? node.get("produced_mana").toString() : "[]");
        card.setPurchaseUrisJson(node.has("purchase_uris") ? node.get("purchase_uris").toString() : "{}");
        card.setRelatedUrisJson(node.has("related_uris") ? node.get("related_uris").toString() : "{}");
        card.setRawJson(node.toString());
        card.setSyncedAt(LocalDateTime.now());

        // Asignar Set
        String setCode = node.get("set").asText();
        CardSet cardSet = cardSetRepository.findByCode(setCode).orElseGet(() -> createNewSet(node));
        card.setSet(cardSet);

        // Guardar ID para nueva carta
        card = cardRepository.save(card);

        // Legalidades
        if (node.has("legalities")) {
            updateLegalities(card, node.get("legalities"));
        }

        // Precios
        if (node.has("prices")) {
            updatePrices(card, node.get("prices"));
        }

        // Caras (si tiene)
        if (node.has("card_faces")) {
            updateFaces(card, node.get("card_faces"));
        }

        return card;
    }

    private CardSet createNewSet(JsonNode node) {
        CardSet set = new CardSet();
        set.setScryfallId(UUID.fromString(node.get("set_id").asText()));
        set.setCode(node.get("set").asText());
        set.setName(node.get("set_name").asText());
        set.setReleasedAt(LocalDate.parse(node.get("released_at").asText())); // Aproximado si no hay set info
        set.setSetType(node.has("set_type") ? node.get("set_type").asText() : "unknown");
        set.setDigital(node.has("digital") ? node.get("digital").asBoolean() : false);
        return cardSetRepository.save(set);
    }

    private void updateLegalities(Card card, JsonNode legalitiesNode) {
        // Eliminar existentes para esta carta
        cardLegalityRepository.deleteByCard(card);

        Iterator<Map.Entry<String, JsonNode>> fields = legalitiesNode.properties().iterator();
        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> entry = fields.next();
            CardLegality legality = new CardLegality();
            legality.setCard(card);
            legality.setFormatName(entry.getKey());
            legality.setLegalityStatus(entry.getValue().asText());
            cardLegalityRepository.save(legality);
        }
    }

    private void updatePrices(Card card, JsonNode pricesNode) {
        CardPrice price = cardPriceRepository.findByCard(card).orElse(new CardPrice());
        price.setCard(card);
        price.setUsd(pricesNode.has("usd") && !pricesNode.get("usd").isNull()
                ? new BigDecimal(pricesNode.get("usd").asText())
                : null);
        price.setUsdFoil(pricesNode.has("usd_foil") && !pricesNode.get("usd_foil").isNull()
                ? new BigDecimal(pricesNode.get("usd_foil").asText())
                : null);
        price.setUsdEtched(pricesNode.has("usd_etched") && !pricesNode.get("usd_etched").isNull()
                ? new BigDecimal(pricesNode.get("usd_etched").asText())
                : null);
        price.setEur(pricesNode.has("eur") && !pricesNode.get("eur").isNull()
                ? new BigDecimal(pricesNode.get("eur").asText())
                : null);
        price.setEurFoil(pricesNode.has("eur_foil") && !pricesNode.get("eur_foil").isNull()
                ? new BigDecimal(pricesNode.get("eur_foil").asText())
                : null);
        price.setTix(pricesNode.has("tix") && !pricesNode.get("tix").isNull()
                ? new BigDecimal(pricesNode.get("tix").asText())
                : null);
        price.setUpdatedAt(LocalDateTime.now());
        cardPriceRepository.save(price);
    }

    private void updateFaces(Card card, JsonNode facesNode) {
        cardFaceRepository.deleteByCard(card);
        int order = 0;
        for (JsonNode faceNode : facesNode) {
            CardFace face = new CardFace();
            face.setCard(card);
            face.setFaceOrder(order++);
            face.setName(faceNode.get("name").asText());
            face.setManaCost(faceNode.has("mana_cost") ? faceNode.get("mana_cost").asText() : null);
            face.setTypeLine(faceNode.has("type_line") ? faceNode.get("type_line").asText() : null);
            face.setOracleText(faceNode.has("oracle_text") ? faceNode.get("oracle_text").asText() : null);
            face.setPower(faceNode.has("power") ? faceNode.get("power").asText() : null);
            face.setToughness(faceNode.has("toughness") ? faceNode.get("toughness").asText() : null);
            face.setLoyalty(faceNode.has("loyalty") ? faceNode.get("loyalty").asText() : null);
            face.setDefense(faceNode.has("defense") ? faceNode.get("defense").asText() : null);
            face.setFlavorText(faceNode.has("flavor_text") ? faceNode.get("flavor_text").asText() : null);
            face.setArtist(faceNode.has("artist") ? faceNode.get("artist").asText() : null);
            face.setColorsJson(faceNode.has("colors") ? faceNode.get("colors").toString() : "[]");

            if (faceNode.has("image_uris")) {
                JsonNode images = faceNode.get("image_uris");
                face.setSmallImageUri(images.has("small") ? images.get("small").asText() : null);
                face.setNormalImageUri(images.has("normal") ? images.get("normal").asText() : null);
                face.setLargeImageUri(images.has("large") ? images.get("large").asText() : null);
                face.setPngImageUri(images.has("png") ? images.get("png").asText() : null);
                face.setArtCropUri(images.has("art_crop") ? images.get("art_crop").asText() : null);
                face.setBorderCropUri(images.has("border_crop") ? images.get("border_crop").asText() : null);
            }

            face.setRawJson(faceNode.toString());
            cardFaceRepository.save(face);
        }
    }
}
