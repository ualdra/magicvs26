package com.magicvs.backend.controller;

import com.magicvs.backend.model.Card;
import com.magicvs.backend.repository.CardRepository;
import com.magicvs.backend.repository.CardSetRepository;
import com.magicvs.backend.service.CardService;
import com.magicvs.backend.dto.CardSummaryDTO;
import com.magicvs.backend.dto.CardDetailDTO;
import com.magicvs.backend.service.CardService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PathVariable;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/cards")
@CrossOrigin(origins = "http://localhost:4200")
public class CardController {

    private static final String IMAGE_FALLBACK = "https://placehold.co/488x680/111827/e5e7eb?text=MagicVS";
    private static final Pattern COLOR_TOKEN_PATTERN = Pattern.compile("\"(W|U|B|R|G)\"");
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Autowired
    private CardRepository cardRepository;

    @Autowired
    private CardSetRepository cardSetRepository;
  
    @Autowired
    private CardService cardService;

    @GetMapping("/stats")
    public Map<String, Object> getStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalCards", cardRepository.count());
        stats.put("totalSets", cardSetRepository.count());
        return stats;
    }

    @GetMapping("/list")
    public Page<Card> listCards(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return cardRepository.findAll(PageRequest.of(page, size));
    }
    @GetMapping
    public ResponseEntity<Page<CardSummaryDTO>> getAllCards(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(cardService.getCardsList(PageRequest.of(page, size)));
    }
    @GetMapping("/{id}")
    public ResponseEntity<CardDetailDTO> getCardById(@PathVariable Long id) {
        return cardService.getCardDetail(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
                }

    /**
     * Busca cartas por nombre con paginacion
     * GET /api/cards/search?name=query&page=0&size=24
     */
    @GetMapping("/search")
    public ResponseEntity<CardSearchPageResponse> searchCards(
            @RequestParam String name,
            @RequestParam(defaultValue = "") String color,
            @RequestParam(defaultValue = "") String type,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "24") int size) {

        String normalizedName = name == null ? "" : name.trim();
        String normalizedColor = color == null ? "" : color.trim();
        String normalizedType = type == null ? "" : type.trim();

        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 50));

        Pageable pageable = PageRequest.of(safePage, safeSize);
        Page<CardSearchResponse> mappedPage = cardRepository
            .searchProjectedByNameAndFilters(normalizedName, normalizedColor, normalizedType, pageable)
                .map(card -> new CardSearchResponse(
                        card.getId(),
                resolveDisplayName(card.getName(), card.getRawJson()),
                resolveDisplayManaCost(card.getManaCost(), card.getRawJson()),
                resolveDisplayType(card.getTypeLine(), card.getRawJson()),
                resolveImageUrl(
                    card.getNormalImageUri(),
                    card.getSmallImageUri(),
                    card.getFaceNormalImageUri(),
                    card.getFaceSmallImageUri()
                ),
                resolveBackImageUrl(card.getBackFaceNormalImageUri(), card.getBackFaceSmallImageUri()),
                isDoubleFacedCard(card.getName(), card.getBackFaceNormalImageUri(), card.getBackFaceSmallImageUri()),
                        resolveColors(card.getColorsJson(), card.getManaCost())
                ));

        CardSearchPageResponse response = new CardSearchPageResponse(
                mappedPage.getContent(),
                mappedPage.getNumber(),
                mappedPage.getSize(),
                mappedPage.getTotalElements(),
                mappedPage.getTotalPages(),
                mappedPage.isFirst(),
                mappedPage.isLast()
        );

        return new ResponseEntity<>(response, HttpStatus.OK);
    }

    private static List<String> extractColorsFromManaCost(String manaCost) {
        if (manaCost == null || manaCost.isBlank()) {
            return List.of();
        }

        String value = manaCost.toUpperCase(Locale.ROOT);
        List<String> colors = new ArrayList<>();

        if (value.contains("{W}")) colors.add("W");
        if (value.contains("{U}")) colors.add("U");
        if (value.contains("{B}")) colors.add("B");
        if (value.contains("{R}")) colors.add("R");
        if (value.contains("{G}")) colors.add("G");

        return colors;
    }

    private static String resolveImageUrl(
            String normalImageUri,
            String smallImageUri,
            String faceNormalImageUri,
            String faceSmallImageUri
    ) {
        if (normalImageUri != null && !normalImageUri.isBlank()) {
            return normalImageUri;
        }
        if (smallImageUri != null && !smallImageUri.isBlank()) {
            return smallImageUri;
        }
        if (faceNormalImageUri != null && !faceNormalImageUri.isBlank()) {
            return faceNormalImageUri;
        }
        if (faceSmallImageUri != null && !faceSmallImageUri.isBlank()) {
            return faceSmallImageUri;
        }
        return IMAGE_FALLBACK;
    }

    private static String resolveBackImageUrl(String backFaceNormalImageUri, String backFaceSmallImageUri) {
        if (backFaceNormalImageUri != null && !backFaceNormalImageUri.isBlank()) {
            return backFaceNormalImageUri;
        }
        if (backFaceSmallImageUri != null && !backFaceSmallImageUri.isBlank()) {
            return backFaceSmallImageUri;
        }
        return null;
    }

    private static boolean isDoubleFacedCard(String name, String backFaceNormalImageUri, String backFaceSmallImageUri) {
        if (name == null || !name.contains(" // ")) {
            return false;
        }
        return (backFaceNormalImageUri != null && !backFaceNormalImageUri.isBlank())
                || (backFaceSmallImageUri != null && !backFaceSmallImageUri.isBlank());
    }

    private static List<String> resolveColors(String colorsJson, String manaCost) {
        List<String> colors = extractColorsFromJson(colorsJson);
        if (!colors.isEmpty()) {
            return colors;
        }
        return extractColorsFromManaCost(manaCost);
    }

    private static List<String> extractColorsFromJson(String colorsJson) {
        if (colorsJson == null || colorsJson.isBlank()) {
            return List.of();
        }

        Matcher matcher = COLOR_TOKEN_PATTERN.matcher(colorsJson.toUpperCase(Locale.ROOT));
        List<String> colors = new ArrayList<>();
        while (matcher.find()) {
            String color = matcher.group(1);
            if (!colors.contains(color)) {
                colors.add(color);
            }
        }
        return colors;
    }

    private static String resolveDisplayName(String defaultName, String rawJson) {
        String localized = extractStringFromRawJson(rawJson, "printed_name");
        return (localized != null && !localized.isBlank()) ? localized : defaultName;
    }

    private static String resolveDisplayType(String defaultTypeLine, String rawJson) {
        String localized = extractStringFromRawJson(rawJson, "printed_type_line");
        if (localized != null && !localized.isBlank()) {
            return localized;
        }
        return defaultTypeLine == null ? "" : defaultTypeLine;
    }

    private static String resolveDisplayManaCost(String defaultManaCost, String rawJson) {
        String localized = extractStringFromRawJson(rawJson, "printed_mana_cost");
        if (localized != null && !localized.isBlank()) {
            return localized;
        }
        return defaultManaCost == null ? "" : defaultManaCost;
    }

    private static String extractStringFromRawJson(String rawJson, String field) {
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

    static class CardSearchResponse {
        private Long id;
        private String name;
        private String manaCost;
        private String type;
        private String imageUrl;
        private String backImageUrl;
        private boolean doubleFaced;
        private List<String> colors;

        public CardSearchResponse(Long id, String name, String manaCost, String type, String imageUrl, String backImageUrl, boolean doubleFaced, List<String> colors) {
            this.id = id;
            this.name = name;
            this.manaCost = manaCost;
            this.type = type;
            this.imageUrl = imageUrl;
            this.backImageUrl = backImageUrl;
            this.doubleFaced = doubleFaced;
            this.colors = colors;
        }

        public Long getId() {
            return id;
        }

        public void setId(Long id) {
            this.id = id;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getManaCost() {
            return manaCost;
        }

        public void setManaCost(String manaCost) {
            this.manaCost = manaCost;
        }

        public String getType() {
            return type;
        }

        public void setType(String type) {
            this.type = type;
        }

        public String getImageUrl() {
            return imageUrl;
        }

        public void setImageUrl(String imageUrl) {
            this.imageUrl = imageUrl;
        }

        public String getBackImageUrl() {
            return backImageUrl;
        }

        public void setBackImageUrl(String backImageUrl) {
            this.backImageUrl = backImageUrl;
        }

        public boolean isDoubleFaced() {
            return doubleFaced;
        }

        public void setDoubleFaced(boolean doubleFaced) {
            this.doubleFaced = doubleFaced;
        }

        public List<String> getColors() {
            return colors;
        }

        public void setColors(List<String> colors) {
            this.colors = colors;
        }
    }

    static class CardSearchPageResponse {
        private List<CardSearchResponse> content;
        private int page;
        private int size;
        private long totalElements;
        private int totalPages;
        private boolean first;
        private boolean last;

        public CardSearchPageResponse(List<CardSearchResponse> content, int page, int size, long totalElements, int totalPages, boolean first, boolean last) {
            this.content = content;
            this.page = page;
            this.size = size;
            this.totalElements = totalElements;
            this.totalPages = totalPages;
            this.first = first;
            this.last = last;
        }

        public List<CardSearchResponse> getContent() {
            return content;
        }

        public void setContent(List<CardSearchResponse> content) {
            this.content = content;
        }

        public int getPage() {
            return page;
        }

        public void setPage(int page) {
            this.page = page;
        }

        public int getSize() {
            return size;
        }

        public void setSize(int size) {
            this.size = size;
        }

        public long getTotalElements() {
            return totalElements;
        }

        public void setTotalElements(long totalElements) {
            this.totalElements = totalElements;
        }

        public int getTotalPages() {
            return totalPages;
        }

        public void setTotalPages(int totalPages) {
            this.totalPages = totalPages;
        }

        public boolean isFirst() {
            return first;
        }

        public void setFirst(boolean first) {
            this.first = first;
        }

        public boolean isLast() {
            return last;
        }

        public void setLast(boolean last) {
            this.last = last;
        }
    }
}
