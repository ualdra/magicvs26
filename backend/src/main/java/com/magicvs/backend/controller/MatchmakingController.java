package com.magicvs.backend.controller;

import com.magicvs.backend.dto.MatchmakingRequest;
import com.magicvs.backend.service.AuthService;
import com.magicvs.backend.service.MatchmakingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@Slf4j
@RestController
@CrossOrigin(origins = "http://localhost:4200")
@RequestMapping("/api/matchmaking")
@RequiredArgsConstructor
public class MatchmakingController {

    private final MatchmakingService matchmakingService;
    private final AuthService authService;

    @PostMapping("/join")
    public ResponseEntity<Map<String, String>> joinQueue(
            @RequestHeader("Authorization") String token,
            @RequestBody MatchmakingRequest request
    ) {
        Long userId = authService.getUserId(token.replace("Bearer ", ""))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid token"));

        Long deckId = request.getDeckId();
        if (deckId == null) {
            log.warn("Join attempt without deckId for user: {}", userId);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Se requiere un ID de mazo");
        }

        log.info("User {} joining matchmaking queue with deck {}", userId, deckId);
        matchmakingService.joinQueue(userId, deckId);
        return ResponseEntity.ok(Map.of("message", "En cola de matchmaking"));
    }

    @PostMapping("/leave")
    public ResponseEntity<Map<String, String>> leaveQueue(
            @RequestHeader("Authorization") String token
    ) {
        Long userId = authService.getUserId(token.replace("Bearer ", ""))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid token"));

        log.info("User {} leaving matchmaking queue", userId);
        matchmakingService.leaveQueue(userId);
        return ResponseEntity.ok(Map.of("message", "Has salido de la cola"));
    }
}
