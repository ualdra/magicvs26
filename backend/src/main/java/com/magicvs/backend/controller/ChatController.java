package com.magicvs.backend.controller;

import com.magicvs.backend.dto.ChatMessageDto;
import com.magicvs.backend.service.AuthService;
import com.magicvs.backend.service.ChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:4200")
public class ChatController {

    private final ChatService chatService;
    private final AuthService authService;

    @GetMapping("/history/{otherUserId}")
    public ResponseEntity<List<ChatMessageDto>> getHistory(
            @RequestHeader("Authorization") String token,
            @PathVariable Long otherUserId
    ) {
        Long userId = authService.getUserId(token.replace("Bearer ", ""))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));

        return ResponseEntity.ok(chatService.getHistory(userId, otherUserId));
    }

    @PostMapping("/send")
    public ResponseEntity<ChatMessageDto> sendMessage(
            @RequestHeader("Authorization") String token,
            @RequestBody Map<String, Object> payload
    ) {
        Long senderId = authService.getUserId(token.replace("Bearer ", ""))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));

        Long receiverId = Long.valueOf(payload.get("receiverId").toString());
        String content = payload.get("content").toString();

        return ResponseEntity.ok(chatService.sendMessage(senderId, receiverId, content));
    }

    @PutMapping("/read/{senderId}")
    public ResponseEntity<Void> markAsRead(
            @RequestHeader("Authorization") String token,
            @PathVariable Long senderId
    ) {
        Long receiverId = authService.getUserId(token.replace("Bearer ", ""))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));

        chatService.markAsRead(receiverId, senderId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/unread")
    public ResponseEntity<Map<Long, Long>> getUnreadCounts(@RequestHeader("Authorization") String token) {
        Long userId = authService.getUserId(token.replace("Bearer ", ""))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));

        return ResponseEntity.ok(chatService.getUnreadCounts(userId));
    }
}
