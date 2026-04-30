package com.magicvs.backend.controller;

import com.magicvs.backend.dto.UserDirectoryResponseDto;
import com.magicvs.backend.service.AuthService;
import com.magicvs.backend.service.FriendshipService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/friendships")
public class FriendshipController {

    private final FriendshipService friendshipService;
    private final AuthService authService;

    public FriendshipController(FriendshipService friendshipService, AuthService authService) {
        this.friendshipService = friendshipService;
        this.authService = authService;
    }

    @PostMapping("/request/{receiverId}")
    public ResponseEntity<?> sendRequest(@RequestHeader("Authorization") String token,
                                        @PathVariable Long receiverId) {
        Long senderId = authService.getUserId(token.replace("Bearer ", ""))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        friendshipService.sendFriendRequest(senderId, receiverId);
        return ResponseEntity.ok(Map.of("message", "Solicitud enviada"));
    }

    @PostMapping("/cancel/{receiverId}")
    public ResponseEntity<?> cancelRequest(@RequestHeader("Authorization") String token,
                                          @PathVariable Long receiverId) {
        Long senderId = authService.getUserId(token.replace("Bearer ", ""))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        friendshipService.cancelFriendRequest(senderId, receiverId);
        return ResponseEntity.ok(Map.of("message", "Solicitud cancelada"));
    }

    @PostMapping("/accept/{senderId}")
    public ResponseEntity<?> acceptRequest(@RequestHeader("Authorization") String token,
                                          @PathVariable Long senderId) {
        Long receiverId = authService.getUserId(token.replace("Bearer ", ""))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        friendshipService.acceptFriendRequest(receiverId, senderId);
        return ResponseEntity.ok(Map.of("message", "Solicitud aceptada"));
    }

    @PostMapping("/reject/{senderId}")
    public ResponseEntity<?> rejectRequest(@RequestHeader("Authorization") String token,
                                          @PathVariable Long senderId) {
        Long receiverId = authService.getUserId(token.replace("Bearer ", ""))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        friendshipService.rejectFriendRequest(receiverId, senderId);
        return ResponseEntity.ok(Map.of("message", "Solicitud rechazada"));
    }

    @DeleteMapping("/{friendId}")
    public ResponseEntity<?> removeFriend(@RequestHeader("Authorization") String token,
                                         @PathVariable Long friendId) {
        Long userId = authService.getUserId(token.replace("Bearer ", ""))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        friendshipService.removeFriend(userId, friendId);
        return ResponseEntity.ok(Map.of("message", "Amigo eliminado"));
    }

    @GetMapping("/status/{targetUserId}")
    public ResponseEntity<?> getStatus(@RequestHeader("Authorization") String token,
                                      @PathVariable Long targetUserId) {
        Long userId = authService.getUserId(token.replace("Bearer ", ""))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        String status = friendshipService.getFriendshipStatus(userId, targetUserId);
        
        // We also want to know WHO sent the request if it's PENDING
        // But for now, let's just return the status.
        return ResponseEntity.ok(Map.of("status", status));
    }

    @GetMapping
    public ResponseEntity<List<UserDirectoryResponseDto>> getFriends(@RequestHeader("Authorization") String token) {
        Long userId = authService.getUserId(token.replace("Bearer ", ""))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        
        List<UserDirectoryResponseDto> friends = friendshipService.getAcceptedFriends(userId).stream()
                .map(u -> {
                    UserDirectoryResponseDto dto = UserDirectoryResponseDto.fromEntity(u);
                    dto.setFriendshipStatus("ACCEPTED");
                    return dto;
                })
                .collect(Collectors.toList());
        
        return ResponseEntity.ok(friends);
    }
}
