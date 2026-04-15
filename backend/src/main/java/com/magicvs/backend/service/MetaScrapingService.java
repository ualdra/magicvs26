package com.magicvs.backend.service;

import com.magicvs.backend.model.Card;
import com.magicvs.backend.model.MetaDeck;
import com.magicvs.backend.repository.CardRepository;
import com.magicvs.backend.repository.MetaDeckRepository;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.*;

@Service
public class MetaScrapingService {

    private static final Logger log = LoggerFactory.getLogger(MetaScrapingService.class);
    private static final String MTG_GOLDFISH_BASE_URL = "https://www.mtggoldfish.com";

    @Autowired
    private MetaDeckRepository metaDeckRepository;

    @Autowired
    private CardRepository cardRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Sincroniza los arquetipos de MTGGoldfish.
     * Se ejecuta todos los días a las 4 AM.
     */
    @Scheduled(cron = "0 0 4 * * ?")
    @Transactional
    public void cronSync() {
        syncMetagame("30");
    }

    @Transactional
    public void syncMetagame(String days) {
        // MTGGoldfish doesn't natively expose discrete time paths in this endpoint anymore, 
        // so we route all time-bracket requests to the live rolling baseline to prevent 404 crashes.
        String url = "https://www.mtggoldfish.com/metagame/standard#paper";
        log.info("Iniciando escaneo del metajuego en MTGGoldfish (solicitado: {} días)... {}", days, url);

        try {
            // Simulator User-Agent to bypass superficial bot protections
            Document doc = Jsoup.connect(url)
                    .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                    .header("Accept-Language", "en-US,en;q=0.9")
                    .get();

            Elements tiles = doc.select(".archetype-tile");
            if (tiles.isEmpty()) {
                log.warn("No se encontraron mazos en MTGGoldfish. Puede que la sintaxis HTML haya cambiado o Cloudflare bloqueó la petición.");
                return;
            }

            // Wipe existing metagame to replace with fresh standing 
            metaDeckRepository.deleteAllInBatch();
            
            List<MetaDeck> newDecks = new ArrayList<>();
            int currentTierIndex = 1;

            for (Element tile : tiles) {
                try {
                    MetaDeck deck = new MetaDeck();
                    
                    // Nombre y URL
                    Element nameLink = tile.selectFirst(".deck-price-paper a");
                    if (nameLink == null) continue;
                    
                    deck.setName(nameLink.text());
                    deck.setFullListUrl(MTG_GOLDFISH_BASE_URL + nameLink.attr("href"));
                    
                    // Presencia (Porcentaje)
                    Element percentElem = tile.selectFirst(".metagame-percentage .archetype-tile-statistic-value");
                    if (percentElem != null) {
                        String rawPercent = percentElem.text().replaceAll("\\(.*?\\)", "").trim();
                        deck.setPresence(rawPercent);
                    }
                    
                    // Filtro Anti-Budget / Casual Decks:
                    // Si no tiene % de presencia oficial, o el nombre lleva signos de ser budget barato, lo ignoramos para mantener la limpieza del Tier
                    if (deck.getPresence() == null || deck.getPresence().isEmpty() || 
                        deck.getName().toLowerCase().contains("budget") || 
                        deck.getName().trim().startsWith("$")) {
                        continue;
                    }

                    // Precio Físico
                    Element priceElem = tile.selectFirst(".deck-price-paper .archetype-tile-statistic-value");
                    if (priceElem != null) {
                        deck.setPrice(priceElem.text().trim());
                    }

                    // Colores
                    List<String> colors = new ArrayList<>();
                    Elements colorIcons = tile.select(".manacost-container i");
                    for (Element icon : colorIcons) {
                        String classes = icon.attr("class");
                        if (classes.contains("ms-w")) colors.add("w");
                        if (classes.contains("ms-u")) colors.add("u");
                        if (classes.contains("ms-b")) colors.add("b");
                        if (classes.contains("ms-r")) colors.add("r");
                        if (classes.contains("ms-g")) colors.add("g");
                    }
                    deck.setColorsJson(objectMapper.writeValueAsString(colors));

                    // Cartas Clave (De lista inferior)
                    List<String> keyCardNames = new ArrayList<>();
                    List<Map<String, String>> gallery = new ArrayList<>();
                    
                    Elements keyCardsLi = tile.select("ul li");
                    for (Element li : keyCardsLi) {
                        String cName = li.text();
                        keyCardNames.add(cName);
                        
                        // Buscar en nuestra base de datos para recuperar el arte de alta calidad
                        Optional<Card> dbCard = cardRepository.findFirstByNameIgnoreCase(cName);
                        dbCard.ifPresent(c -> {
                            Map<String, String> imgData = new HashMap<>();
                            imgData.put("name", cName);
                            // Preferimos artCropUri si existe para la galería
                            String imageUrl = c.getArtCropUri() != null ? c.getArtCropUri() : c.getNormalImageUri();
                            if (imageUrl != null) {
                                imgData.put("imageUrl", imageUrl);
                                gallery.add(imgData);
                            }
                        });
                    }
                    deck.setKeyCardsString(String.join(", ", keyCardNames));
                    deck.setGalleryJson(objectMapper.writeValueAsString(gallery));
                    
                    // Extracción Profunda del Mazo (Subpágina)
                    try {
                        Document subDoc = Jsoup.connect(deck.getFullListUrl())
                                .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                                .header("Accept-Language", "en-US,en;q=0.9")
                                .get();

                        List<Map<String, Object>> mainboard = new ArrayList<>();
                        
                        // En las páginas de Archetype, la tabla HTML suele cargarse por JS. 
                        // Sin embargo, MTGGoldfish inyecta la lista cruda en un input oculto para su botón de "Exportar".
                        Element deckInput = subDoc.getElementById("deck_input_deck");
                        if (deckInput != null) {
                            String rawList = deckInput.attr("value");
                            String[] lines = rawList.split("\n");
                            
                            boolean isSideboard = false;

                            for (String line : lines) {
                                line = line.trim();
                                if (line.isEmpty()) continue;
                                
                                if (line.equalsIgnoreCase("sideboard")) {
                                    isSideboard = true;
                                    continue;
                                }
                                
                                int spaceIdx = line.indexOf(' ');
                                if (spaceIdx > 0) {
                                    String qtyStr = line.substring(0, spaceIdx);
                                    if (qtyStr.matches("\\d+")) {
                                        int qty = Integer.parseInt(qtyStr);
                                        String cardName = line.substring(spaceIdx + 1).trim();
                                        
                                        Map<String, Object> cardRow = new HashMap<>();
                                        cardRow.put("quantity", qty);
                                        cardRow.put("name", cardName);
                                        cardRow.put("isSideboard", isSideboard);
                                        
                                        // Buscar versión en Español, si no existe caer atrás en la oficial.
                                        Card dbCard = cardRepository.findFirstByNameIgnoreCaseAndLang(cardName, "es")
                                                .orElseGet(() -> cardRepository.findFirstByNameIgnoreCase(cardName).orElse(null));

                                        if (dbCard != null) {
                                            // Si existe dbCard y logramos enganchar el idioma ES, inyectamos su traducción
                                            if ("es".equals(dbCard.getLang()) && dbCard.getRawJson() != null) {
                                                try {
                                                    JsonNode node = objectMapper.readTree(dbCard.getRawJson());
                                                    if (node.hasNonNull("printed_name")) {
                                                        cardRow.put("name", node.get("printed_name").asText());
                                                    }
                                                } catch (Exception e) {}
                                            }

                                            // Extraer tipología intacta en Inglés para no romper la división en 3 sacos
                                            if (dbCard.getTypeLine() != null) {
                                                cardRow.put("typeLine", dbCard.getTypeLine());
                                            } else {
                                                cardRow.put("typeLine", "Spell");
                                            }
                                        } else {
                                            cardRow.put("typeLine", "Spell"); // Fallback
                                        }

                                        mainboard.add(cardRow);
                                    }
                                }
                            }
                        }
                        
                        deck.setMainboardJson(objectMapper.writeValueAsString(mainboard));

                        // Pausa de seguridad anti-bots (Cloudflare)
                        Thread.sleep(750);
                    } catch (Exception subpageEx) {
                        log.error("No se pudo extraer la sub-lista profunda de {}: {}", deck.getName(), subpageEx.getMessage());
                    }

                    newDecks.add(deck);

                } catch (Exception elementParsingEx) {
                    log.error("Error parseando un tile específico del mazo. Se omitirá.", elementParsingEx);
                }
            }

            metaDeckRepository.saveAll(newDecks);
            log.info("Metajuego sincronizado exitosamente. {} mazos guardados.", newDecks.size());

        } catch (Exception e) {
            log.error("Fallo crítico durante el scraping de MTGGoldfish: {}", e.getMessage(), e);
        }
    }
}
