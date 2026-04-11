package com.magicvs.backend.controller;

import com.magicvs.backend.model.Card;
import com.magicvs.backend.repository.CardRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api/cards")
@CrossOrigin(origins = "http://localhost:4200")
@Transactional(readOnly = true)
public class CardControllerCardsExamples {

    private final CardRepository cardRepository;

    public CardControllerCardsExamples(CardRepository cardRepository) {
        this.cardRepository = cardRepository;
    }

    /**
     * Busca cartas por nombre
     * GET /api/cards/search?name=query&limit=20
     */
    @GetMapping("/search")
    public ResponseEntity<List<CardSearchResponse>> searchCards(
            @RequestParam String name,
            @RequestParam(defaultValue = "20") int limit) {
        
        if (name == null || name.trim().isEmpty()) {
            return new ResponseEntity<>(List.of(), HttpStatus.OK);
        }

        Pageable pageable = PageRequest.of(0, Math.min(limit, 50));
        List<CardSearchResponse> results = cardRepository
                .searchProjectedByName(name, pageable)
                .getContent()
                .stream()
                .map(card -> new CardSearchResponse(
                        card.getId(),
                        card.getName(),
                        card.getManaCost() == null ? "" : card.getManaCost(),
                        card.getTypeLine() == null ? "" : card.getTypeLine(),
                    "https://placehold.co/488x680/111827/e5e7eb?text=MagicVS",
                        extractColorsFromManaCost(card.getManaCost())
                ))
                .toList();
        
        return new ResponseEntity<>(results, HttpStatus.OK);
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

    /**
     * Obtiene una carta por ID
     * GET /api/cards/:cardId
     */
    @GetMapping("/{cardId}")
    public ResponseEntity<?> getCardById(@PathVariable Long cardId) {
        var card = cardRepository.findById(cardId);
        if (card.isPresent()) {
            return new ResponseEntity<>(card.get(), HttpStatus.OK);
        } else {
            return new ResponseEntity<>(new ErrorResponse("Carta no encontrada"), HttpStatus.NOT_FOUND);
        }
    }

    /**
     * Obtiene todas las cartas con paginación
     * GET /api/cards?page=0&size=20
     */
    @GetMapping
    public ResponseEntity<List<Card>> getAllCards(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        
        Pageable pageable = PageRequest.of(page, Math.min(size, 100));
        List<Card> cards = cardRepository.findAll(pageable).getContent();
        
        return new ResponseEntity<>(cards, HttpStatus.OK);
    }

    /**
     * Clase interna para errores
     */
    static class ErrorResponse {
        private String message;

        public ErrorResponse(String message) {
            this.message = message;
        }

        public String getMessage() {
            return message;
        }

        public void setMessage(String message) {
            this.message = message;
        }
    }

    static class CardSearchResponse {
        private Long id;
        private String name;
        private String manaCost;
        private String type;
        private String imageUrl;
        private List<String> colors;

        public CardSearchResponse(Long id, String name, String manaCost, String type, String imageUrl, List<String> colors) {
            this.id = id;
            this.name = name;
            this.manaCost = manaCost;
            this.type = type;
            this.imageUrl = imageUrl;
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

        public List<String> getColors() {
            return colors;
        }

        public void setColors(List<String> colors) {
            this.colors = colors;
        }
    }
}
