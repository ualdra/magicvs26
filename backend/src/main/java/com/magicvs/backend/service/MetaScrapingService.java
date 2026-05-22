package com.magicvs.backend.service;

import com.magicvs.backend.model.Card;
import com.magicvs.backend.model.MetaDeck;
import com.magicvs.backend.repository.CardRepository;
import com.magicvs.backend.repository.MetaDeckRepository;
import org.jsoup.HttpStatusException;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.*;

@Service
@Profile("worker")
public class MetaScrapingService {

    private static final Logger log = LoggerFactory.getLogger(MetaScrapingService.class);
    private static final String MTG_GOLDFISH_BASE_URL = "https://www.mtggoldfish.com";
    private static final String BROWSER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            + "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

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
            Document doc = fetchDocument(url);

            Elements tiles = doc.select(".archetype-tile");
            if (tiles.isEmpty()) {
                if (preserveExistingMetagame("No se encontraron mazos en MTGGoldfish. Puede que la sintaxis HTML haya cambiado o el sitio haya bloqueado la petición.", null)) {
                    return;
                }
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
                            if (c.getScryfallId() != null) {
                                imgData.put("scryfallId", c.getScryfallId().toString());
                            }
                            String imageUrl = c.getArtCropUri() != null ? c.getArtCropUri() : c.getNormalImageUri();
                            if (imageUrl != null) {
                                imgData.put("imageUrl", imageUrl);
                                gallery.add(imgData);
                            } else if (c.getScryfallId() != null) {
                                // Aunque no tengamos URL remota, si hay ID local, añadimos igualmente
                                gallery.add(imgData);
                            }
                        });
                    }
                    deck.setKeyCardsString(String.join(", ", keyCardNames));
                    deck.setGalleryJson(objectMapper.writeValueAsString(gallery));
                    
                    try {
                        Document subDoc = fetchDocument(deck.getFullListUrl());

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
                    } catch (HttpStatusException subpageEx) {
                        log.warn("MTGGoldfish bloqueó la sub-lista de {} con HTTP {}. Se guardará el arquetipo sin lista completa.",
                                deck.getName(), subpageEx.getStatusCode());
                    } catch (Exception subpageEx) {
                        log.warn("No se pudo extraer la sub-lista profunda de {}: {}", deck.getName(), subpageEx.getMessage());
                    }

                    newDecks.add(deck);

                } catch (Exception elementParsingEx) {
                    log.error("Error parseando un tile específico del mazo. Se omitirá.", elementParsingEx);
                }
            }

            metaDeckRepository.saveAll(newDecks);
            log.info("Metajuego sincronizado exitosamente. {} mazos guardados.", newDecks.size());

        } catch (HttpStatusException e) {
            String message = "MTGGoldfish respondió HTTP " + e.getStatusCode() + " al consultar " + e.getUrl();
            if (preserveExistingMetagame(message, e)) {
                return;
            }
            log.error("{} y no hay metajuego previo que conservar.", message, e);
            throw new TransientIngestionException(message, e);
        } catch (Exception e) {
            log.error("Fallo crítico durante el scraping de MTGGoldfish: {}", e.getMessage(), e);
            throw new TransientIngestionException("Fallo crítico durante el scraping de MTGGoldfish", e);
        }
    }

    private Document fetchDocument(String url) throws IOException {
        return Jsoup.connect(url)
                .userAgent(BROWSER_USER_AGENT)
                .referrer("https://www.google.com/")
                .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8")
                .header("Accept-Language", "en-US,en;q=0.9,es;q=0.8")
                .header("Cache-Control", "no-cache")
                .header("Pragma", "no-cache")
                .header("Upgrade-Insecure-Requests", "1")
                .timeout(20_000)
                .followRedirects(true)
                .get();
    }

    private boolean preserveExistingMetagame(String reason, Exception cause) {
        long existingDecks = metaDeckRepository.count();
        if (existingDecks > 0) {
            String causeMessage = cause == null ? "" : " Causa: " + cause.getClass().getSimpleName() + ": " + cause.getMessage();
            log.warn("{} Conservando {} mazos existentes.{}", reason, existingDecks, causeMessage);
            return true;
        }

        log.warn("{} No hay mazos existentes que conservar.", reason);
        return false;
    }
}
