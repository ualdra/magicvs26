package com.magicvs.backend.controller;

import com.magicvs.backend.dto.MatchmakingRequest;
import com.magicvs.backend.model.User;
import com.magicvs.backend.repository.RegistroRepository; // CAMBIADO: Usamos el unificado
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
@RequestMapping("/api/matchmaking")
@RequiredArgsConstructor
public class MatchmakingController {

    private final MatchmakingService matchmakingService;
    private final AuthService authService;
    private final RegistroRepository registroRepository;

    @PostMapping("/join")
    public ResponseEntity<Map<String, Object>> joinQueue(
            @RequestHeader(value = "Authorization", required = false) String token,
            @RequestBody MatchmakingRequest request
    ) {
        // 1. Validar presencia y formato del Token
        if (token == null || !token.startsWith("Bearer ")) {
            log.warn("Intento de acceso sin token válido");
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Formato de token inválido");
        }

        String jwt = token.substring(7);

        // 2. Extraer ID del usuario del Token
        Long userId = authService.getUserId(jwt)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sesión inválida o expirada"));

        // 3. Obtener el Usuario de la DB unificada
        User user = registroRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        // 4. Validar el mazo seleccionado
        Long deckId = request.getDeckId();
        if (deckId == null) {
            log.warn("Usuario {} intentó entrar sin seleccionar mazo", userId);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Debes seleccionar un mazo para jugar");
        }

        log.info("Matchmaking: Usuario {} (ELO: {}) entrando en cola con mazo {}", 
                 user.getUsername(), user.getElo(), deckId);
        
        matchmakingService.joinQueue(user.getId(), user.getElo(), deckId);

        return ResponseEntity.ok(Map.of(
            "message", "En cola",
            "elo", user.getElo(),
            "status", "SEARCHING"
        ));
    }

    @PostMapping("/leave")
    public ResponseEntity<Map<String, String>> leaveQueue(
            @RequestHeader(value = "Authorization", required = false) String token
    ) {
        if (token == null || !token.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Token no proporcionado");
        }

        Long userId = authService.getUserId(token.substring(7))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Token inválido"));

        log.info("Usuario {} saliendo de la cola", userId);
        matchmakingService.leaveQueue(userId);

        return ResponseEntity.ok(Map.of("message", "Has salido de la cola correctamente"));
    }
}