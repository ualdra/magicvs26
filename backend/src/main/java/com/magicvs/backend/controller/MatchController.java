package com.magicvs.backend.controller;

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
    private final com.magicvs.backend.service.BattleService battleService;
    private final com.magicvs.backend.repository.FriendshipRepository friendshipRepository;
    private final com.magicvs.backend.repository.RegistroRepository registroRepository;

    public MatchController(MatchService matchService, AuthService authService,
                           com.magicvs.backend.service.BattleService battleService,
                           com.magicvs.backend.repository.FriendshipRepository friendshipRepository,
                           com.magicvs.backend.repository.RegistroRepository registroRepository) {
        this.matchService = matchService;
        this.authService = authService;
        this.battleService = battleService;
        this.friendshipRepository = friendshipRepository;
        this.registroRepository = registroRepository;
    }

    @GetMapping("/history")
    public ResponseEntity<List<MatchHistoryDto>> getHistory(@RequestHeader("Authorization") String token) {
        Long userId = authService.getUserId(token.replace("Bearer ", ""))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid token"));
        
        List<MatchHistoryDto> history = matchService.getHistoryForUser(userId);
        return ResponseEntity.ok(history);
    }

    @GetMapping("/friends/active")
    public ResponseEntity<List<MatchHistoryDto>> getActiveFriendsMatches(@RequestHeader("Authorization") String token) {
        Long userId = authService.getUserId(token.replace("Bearer ", ""))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid token"));
        
        List<MatchHistoryDto> activeMatches = matchService.getActiveMatchesForFriends(userId);
        return ResponseEntity.ok(activeMatches);
    }

    @GetMapping("/{id}/spectate")
    public ResponseEntity<com.magicvs.backend.service.BattleService.GameState> spectateMatch(
            @RequestHeader("Authorization") String token,
            @PathVariable Long id,
            @RequestParam Long friendId) {
            
        Long userId = authService.getUserId(token.replace("Bearer ", ""))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid token"));
                
        com.magicvs.backend.model.User user = registroRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        com.magicvs.backend.model.User friend = registroRepository.findById(friendId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Friend not found"));

        if (!friendshipRepository.existsByUserAndFriend(user, friend) && !friendshipRepository.existsByUserAndFriend(friend, user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not friends with this user");
        }

        com.magicvs.backend.service.BattleService.GameState state = battleService.getSpectatorState(userId, id, friendId);
        if (state == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(state);
    }
}
