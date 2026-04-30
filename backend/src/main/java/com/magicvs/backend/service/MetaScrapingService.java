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

    @Scheduled(cron = "0 0 4 * * ?")
    @Transactional
    public void cronSync() {
        syncMetagame("30");
    }

    @Transactional
    public void syncMetagame(String days) {
        String url = "https://www.mtggoldfish.com/metagame/standard#paper";
        log.info("Iniciando escaneo del metajuego en MTGGoldfish (solicitado: {} días)... {}", days, url);

        try {
            Document doc = Jsoup.connect(url)
                    .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                    .header("Accept-Language", "en-US,en;q=0.9")
                    .get();

            Elements tiles = doc.select(".archetype-tile");
            if (tiles.isEmpty()) {
                log.warn("No se encontraron mazos en MTGGoldfish. Puede que la sintaxis HTML haya cambiado o Cloudflare bloqueó la petición.");
                return;
            }

            metaDeckRepository.deleteAllInBatch();
            
            List<MetaDeck> newDecks = new ArrayList<>();
            int currentTierIndex = 1;

            for (Element tile : tiles) {
                try {
                    MetaDeck deck = new MetaDeck();
                    
                    Element nameLink = tile.selectFirst(".deck-price-paper a");
                    if (nameLink == null) continue;
                    
                    deck.setName(nameLink.text());
                    deck.setFullListUrl(MTG_GOLDFISH_BASE_URL + nameLink.attr("href"));
                    
                    Element percentElem = tile.selectFirst(".metagame-percentage .archetype-tile-statistic-value");
                    if (percentElem != null) {
                        String rawPercent = percentElem.text().replaceAll("\\(.*?\\)", "").trim();
                        deck.setPresence(rawPercent);
                    }
                    
                    if (deck.getPresence() == null || deck.getPresence().isEmpty() || 
                        deck.getName().toLowerCase().contains("budget") || 
                        deck.getName().trim().startsWith("$")) {
                        continue;
                    }

                    Element priceElem = tile.selectFirst(".deck-price-paper .archetype-tile-statistic-value");
                    if (priceElem != null) {
                        deck.setPrice(priceElem.text().trim());
                    }

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

                    List<String> keyCardNames = new ArrayList<>();
                    List<Map<String, String>> gallery = new ArrayList<>();
                    
                    Elements keyCardsLi = tile.select("ul li");
                    for (Element li : keyCardsLi) {
                        String cName = li.text();
                        keyCardNames.add(cName);
                        
                        Optional<Card> dbCard = cardRepository.findFirstByNameIgnoreCase(cName);
                        dbCard.ifPresent(c -> {
                            Map<String, String> imgData = new HashMap<>();
                            imgData.put("name", cName);
                            String imageUrl = c.getArtCropUri() != null ? c.getArtCropUri() : c.getNormalImageUri();
                            if (imageUrl != null) {
                                imgData.put("imageUrl", imageUrl);
                                gallery.add(imgData);
                            }
                        });
                    }
                    deck.setKeyCardsString(String.join(", ", keyCardNames));
                    deck.setGalleryJson(objectMapper.writeValueAsString(gallery));
                    
                    try {
                        Document subDoc = Jsoup.connect(deck.getFullListUrl())
                                .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                                .header("Accept-Language", "en-US,en;q=0.9")
                                .get();

                        List<Map<String, Object>> mainboard = new ArrayList<>();
                        
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
                                        
                                        Card dbCard = cardRepository.findFirstByNameIgnoreCaseAndLang(cardName, "es")
                                                .orElseGet(() -> cardRepository.findFirstByNameIgnoreCase(cardName).orElse(null));

                                        if (dbCard != null) {
                                            if ("es".equals(dbCard.getLang()) && dbCard.getRawJson() != null) {
                                                try {
                                                    JsonNode node = objectMapper.readTree(dbCard.getRawJson());
                                                    if (node.hasNonNull("printed_name")) {
                                                        cardRow.put("name", node.get("printed_name").asText());
                                                    }
                                                } catch (Exception e) {}
                                            }

                                            if (dbCard.getTypeLine() != null) {
                                                cardRow.put("typeLine", dbCard.getTypeLine());
                                            } else {
                                                cardRow.put("typeLine", "Spell");
                                            }
                                        } else {
                                            cardRow.put("typeLine", "Spell"); 
                                        }

                                        mainboard.add(cardRow);
                                    }
                                }
                            }
                        }
                        
                        deck.setMainboardJson(objectMapper.writeValueAsString(mainboard));

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
