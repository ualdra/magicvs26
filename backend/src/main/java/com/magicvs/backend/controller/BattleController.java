package com.magicvs.backend.controller;

import com.magicvs.backend.dto.MatchResultDTO; 
import com.magicvs.backend.service.BattleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/battle")
@RequiredArgsConstructor
public class BattleController {

    private final BattleService battleService;

    @GetMapping("/{matchId}/state")
    public ResponseEntity<BattleService.GameState> getBattleState(@PathVariable Long matchId) {
        BattleService.GameState state = battleService.getGameState(matchId);
        if (state == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(state);
    }

    @PostMapping("/{matchId}/state")
    public ResponseEntity<Void> updateBattleState(@PathVariable Long matchId, @RequestBody(required = false) Object state) {
        if (state == null) {
            return ResponseEntity.badRequest().build();
        }
        battleService.updateGameState(matchId, state);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{matchId}/finish")
    public ResponseEntity<MatchResultDTO> finishMatch(
            @PathVariable Long matchId, 
            @RequestParam Long winnerId) {
        
        MatchResultDTO result = battleService.finishMatch(matchId, winnerId);
        if (result == null) {
            return ResponseEntity.status(409).build();
        }
        return ResponseEntity.ok(result);
    }
}