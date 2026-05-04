package com.magicvs.backend.controller;

import com.magicvs.backend.dto.CreateMatchDTO;
import com.magicvs.backend.dto.MatchResultDTO;
import com.magicvs.backend.dto.MatchHistoryDto;
import com.magicvs.backend.service.AuthService;
import com.magicvs.backend.service.MatchService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/matches")
public class MatchController {

    private final MatchService matchService;
    private final AuthService authService;

    public MatchController(MatchService matchService, AuthService authService) {
        this.matchService = matchService;
        this.authService = authService;
    }

    @PostMapping("/process")
    public ResponseEntity<MatchResultDTO> playMatch(@RequestBody CreateMatchDTO dto) {
        MatchResultDTO result = matchService.processMatch(dto);
        return ResponseEntity.ok(result);
    }


    @GetMapping("/history")
    public ResponseEntity<List<MatchHistoryDto>> getHistory(@RequestHeader("Authorization") String token) {
        // Extraemos el ID del usuario a partir del token JWT
        Long userId = authService.getUserId(token.replace("Bearer ", ""))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Token inválido o expirado"));
        
        List<MatchHistoryDto> history = matchService.getHistoryForUser(userId);
        return ResponseEntity.ok(history);
    }
}