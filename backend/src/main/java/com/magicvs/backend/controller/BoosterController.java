package com.magicvs.backend.controller;

import com.magicvs.backend.dto.CardSummaryDTO;
import com.magicvs.backend.model.Card;
import com.magicvs.backend.model.User;
import com.magicvs.backend.repository.RegistroRepository;
import com.magicvs.backend.service.AuthService;
import com.magicvs.backend.service.BoosterService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/boosters")
@CrossOrigin(origins = "http://localhost:4200")
public class BoosterController {

    private final BoosterService boosterService;
    private final AuthService authService;
    private final RegistroRepository registroRepository;
    private final com.magicvs.backend.service.CardService cardService;

    public BoosterController(BoosterService boosterService, AuthService authService, RegistroRepository registroRepository, com.magicvs.backend.service.CardService cardService) {
        this.boosterService = boosterService;
        this.authService = authService;
        this.registroRepository = registroRepository;
        this.cardService = cardService;
    }

    @PostMapping("/open")
    public ResponseEntity<List<CardSummaryDTO>> openBooster(
            @RequestHeader(name = "Authorization") String authorization) {
        
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
        }

        Long userId = authService.getUserId(authorization.replace("Bearer ", ""))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid token"));

        User user = registroRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        List<Card> cards = boosterService.openBooster(user);

        List<CardSummaryDTO> dtoList = cards.stream()
                .map(card -> new CardSummaryDTO(
                        card.getId(),
                        card.getScryfallId(),
                        cardService.resolveDisplayName(card.getName(), card.getRawJson()),
                        cardService.resolveDisplayType(card.getTypeLine(), card.getRawJson()),
                        resolveImageUrl(card),
                        card.getRarity()
                ))
                .collect(Collectors.toList());

        return ResponseEntity.ok(dtoList);
    }

    private String resolveImageUrl(Card card) {
        if (card.getNormalImageUri() != null && !card.getNormalImageUri().isBlank()) {
            return card.getNormalImageUri();
        }
        if (card.getSmallImageUri() != null && !card.getSmallImageUri().isBlank()) {
            return card.getSmallImageUri();
        }
        if (card.getFaces() != null && !card.getFaces().isEmpty()) {
            String faceUrl = card.getFaces().get(0).getNormalImageUri();
            if (faceUrl != null && !faceUrl.isBlank()) return faceUrl;
        }
        return "https://placehold.co/488x680/111827/e5e7eb?text=MagicVS";
    }
}
