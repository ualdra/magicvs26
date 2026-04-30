package com.magicvs.backend.controller;

import com.magicvs.backend.service.BattleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@CrossOrigin(origins = "http://localhost:4200")
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
    public ResponseEntity<Void> updateBattleState(@PathVariable Long matchId, @RequestBody Object state) {
        battleService.updateGameState(matchId, state);
        return ResponseEntity.ok().build();
    }
}
