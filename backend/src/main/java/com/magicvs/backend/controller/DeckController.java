package com.magicvs.backend.controller;

import com.magicvs.backend.dto.CreateDeckDTO;
import com.magicvs.backend.dto.DeckResponseDTO;
import com.magicvs.backend.dto.DeckSummaryDTO;
import com.magicvs.backend.service.AuthService;
import com.magicvs.backend.service.DeckService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/decks")
@CrossOrigin(origins = "http://localhost:4200")
public class DeckController {

    private final DeckService deckService;
    private final AuthService authService;

    public DeckController(DeckService deckService, AuthService authService) {
        this.deckService = deckService;
        this.authService = authService;
    }

    @PostMapping
    public ResponseEntity<DeckResponseDTO> createDeck(
        @RequestHeader(value = "Authorization", required = false) String authorization,
        @RequestBody CreateDeckDTO deckDTO
    ) {
        Long userId = extractUserIdFromAuthorization(authorization);
        try {
            DeckResponseDTO response = deckService.createDeck(userId, deckDTO);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage());
        }
    }

    @PutMapping("/{deckId}")
    public ResponseEntity<DeckResponseDTO> updateDeck(
        @PathVariable Long deckId,
        @RequestHeader(value = "Authorization", required = false) String authorization,
        @RequestBody CreateDeckDTO deckDTO
    ) {
        Long userId = extractUserIdFromAuthorization(authorization);
        try {
            return ResponseEntity.ok(deckService.updateDeck(deckId, userId, deckDTO));
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage());
        }
    }

    @GetMapping("/{deckId}")
    public ResponseEntity<DeckResponseDTO> getDeck(
        @PathVariable Long deckId,
        @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        Long userId = extractUserIdFromAuthorization(authorization);
        return ResponseEntity.ok(deckService.getDeckById(deckId, userId));
    }

    @GetMapping("/user/me")
    public ResponseEntity<List<DeckSummaryDTO>> getMyDecks(
        @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        Long userId = extractUserIdFromAuthorization(authorization);
        return ResponseEntity.ok(deckService.getUserDecks(userId));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<DeckSummaryDTO>> getUserDecks(@PathVariable Long userId) {
        return ResponseEntity.ok(deckService.getUserDecks(userId));
    }

    @DeleteMapping("/{deckId}")
    public ResponseEntity<Void> deleteDeck(
        @PathVariable Long deckId,
        @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        Long userId = extractUserIdFromAuthorization(authorization);
        deckService.deleteDeck(deckId, userId);
        return ResponseEntity.noContent().build();
    }

    private Long extractUserIdFromAuthorization(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Token no proporcionado");
        }

        String token = authorization.substring("Bearer ".length());
        return authService.getUserId(token)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Token inválido"));
    }
}