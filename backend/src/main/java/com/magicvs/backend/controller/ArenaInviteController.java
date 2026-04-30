package com.magicvs.backend.controller;

import com.magicvs.backend.model.NotificationType;
import com.magicvs.backend.model.User;
import com.magicvs.backend.repository.RegistroRepository;
import com.magicvs.backend.service.AuthService;
import com.magicvs.backend.service.NotificationService;
import com.magicvs.backend.model.MatchStatus;
import com.magicvs.backend.model.Match;
import com.magicvs.backend.repository.MatchRepository;
import com.magicvs.backend.service.BattleService;
import com.magicvs.backend.repository.DeckRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.Map;

@RestController
@CrossOrigin(origins = "http://localhost:4200")
@RequestMapping("/api/arena")
@RequiredArgsConstructor
public class ArenaInviteController {

    private final RegistroRepository userRepository;
    private final NotificationService notificationService;
    private final AuthService authService;
    private final MatchRepository matchRepository;
    private final BattleService battleService;
    private final DeckRepository deckRepository;

    @PostMapping("/invite/{receiverId}")
    public ResponseEntity<Map<String, String>> inviteToBattle(
            @RequestHeader("Authorization") String token,
            @PathVariable Long receiverId,
            @RequestBody(required = false) Map<String, Long> payload
    ) {
        Long senderId = authService.getUserId(token.replace("Bearer ", ""))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid token"));

        if (senderId.equals(receiverId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No puedes invitarte a ti mismo");
        }

        User sender = userRepository.findById(senderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Remitente no encontrado"));
        User receiver = userRepository.findById(receiverId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Destinatario no encontrado"));

        // Create a match in WAITING status
        com.magicvs.backend.model.Match match = new com.magicvs.backend.model.Match();
        match.setPlayer1(sender);
        match.setPlayer2(receiver);
        match.setStatus(com.magicvs.backend.model.MatchStatus.WAITING);
        match.setFormat("Standard"); // Default for now
        
        Long deckId = (payload != null && payload.containsKey("deckId")) ? payload.get("deckId") : null;
        if (deckId == null) {
            // Pick first deck if none provided (fallback)
            deckId = deckRepository.findByUserIdOrderByUpdatedAtDesc(senderId).stream().findFirst()
                    .map(com.magicvs.backend.model.Deck::getId).orElse(null);
        }
        match.setDeck1Id(deckId);
        
        match = matchRepository.save(match);

        Map<String, Object> data = new HashMap<>();
        data.put("senderId", senderId);
        data.put("matchId", match.getId());
        String name = sender.getDisplayName() != null && !sender.getDisplayName().isBlank() 
                ? sender.getDisplayName() 
                : sender.getUsername();
        data.put("senderName", name);
        data.put("senderAvatar", sender.getAvatarUrl());
        data.put("message", name + " te ha invitado a un duelo.");
        data.put("title", "Invitación a batalla");
        data.put("link", "/battle/" + match.getId());

        notificationService.createNotification(receiverId, NotificationType.BATTLE_INVITE, data);

        return ResponseEntity.ok(Map.of("message", "Invitación enviada con éxito", "matchId", match.getId().toString()));
    }

    @PostMapping("/accept/{matchId}")
    public ResponseEntity<Map<String, String>> acceptInvite(
            @RequestHeader("Authorization") String token,
            @PathVariable Long matchId,
            @RequestBody(required = false) Map<String, Long> payload
    ) {
        Long receiverId = authService.getUserId(token.replace("Bearer ", ""))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid token"));

        Match match = matchRepository.findById(matchId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Partida no encontrada"));

        if (!match.getPlayer2().getId().equals(receiverId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No estás invitado a esta partida");
        }

        Long deckId = (payload != null && payload.containsKey("deckId")) ? payload.get("deckId") : null;
        if (deckId == null) {
            deckId = deckRepository.findByUserIdOrderByUpdatedAtDesc(receiverId).stream().findFirst()
                    .map(com.magicvs.backend.model.Deck::getId).orElse(null);
        }
        match.setDeck2Id(deckId);
        match.setStatus(MatchStatus.LIVE);
        match = matchRepository.save(match);

        // Initialize board state
        battleService.initializeMatch(match.getId(), match.getDeck1Id(), match.getDeck2Id());

        // Notify the inviter (Player 1)
        User inviter = match.getPlayer1();
        Map<String, Object> data = new HashMap<>();
        data.put("matchId", match.getId());
        data.put("title", "¡Reto aceptado!");
        data.put("message", match.getPlayer2().getUsername() + " ha aceptado tu invitación. ¡A la batalla!");
        data.put("link", "/battle/" + match.getId());

        notificationService.createNotification(inviter.getId(), NotificationType.MATCH_FOUND, data);

        return ResponseEntity.ok(Map.of("message", "Invitación aceptada"));
    }
}
