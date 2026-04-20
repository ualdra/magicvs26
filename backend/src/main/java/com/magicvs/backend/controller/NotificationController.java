package com.magicvs.backend.controller;

import com.magicvs.backend.dto.NotificationPageDto;
import com.magicvs.backend.dto.NotificationResponseDto;
import com.magicvs.backend.model.NotificationType;
import com.magicvs.backend.service.AuthService;
import com.magicvs.backend.service.NotificationService;
import com.magicvs.backend.service.NotificationStreamService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Map;

import static org.springframework.http.HttpStatus.UNAUTHORIZED;

@RestController
@CrossOrigin(origins = "http://localhost:4200")
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;
    private final NotificationStreamService notificationStreamService;
    private final AuthService authService;

    public NotificationController(
        NotificationService notificationService,
        NotificationStreamService notificationStreamService,
        AuthService authService
    ) {
        this.notificationService = notificationService;
        this.notificationStreamService = notificationStreamService;
        this.authService = authService;
    }

    @GetMapping
    public ResponseEntity<NotificationPageDto> getNotifications(
        @RequestHeader(name = "Authorization", required = false) String authorization,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        Long userId = extractUserIdFromAuthorization(authorization);
        return ResponseEntity.ok(notificationService.getNotifications(userId, page, Math.min(size, 50)));
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<NotificationResponseDto> markAsRead(
        @RequestHeader(name = "Authorization", required = false) String authorization,
        @PathVariable Long id
    ) {
        Long userId = extractUserIdFromAuthorization(authorization);
        return ResponseEntity.ok(notificationService.markAsRead(userId, id));
    }

    @PatchMapping("/read-all")
    public ResponseEntity<Map<String, Object>> markAllAsRead(
        @RequestHeader(name = "Authorization", required = false) String authorization
    ) {
        Long userId = extractUserIdFromAuthorization(authorization);
        int updated = notificationService.markAllAsRead(userId);
        return ResponseEntity.ok(Map.of("updated", updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteNotification(
        @RequestHeader(name = "Authorization", required = false) String authorization,
        @PathVariable Long id
    ) {
        Long userId = extractUserIdFromAuthorization(authorization);
        notificationService.deleteNotification(userId, id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping
    public ResponseEntity<Map<String, Object>> deleteAllNotifications(
        @RequestHeader(name = "Authorization", required = false) String authorization
    ) {
        Long userId = extractUserIdFromAuthorization(authorization);
        long deleted = notificationService.deleteAllNotifications(userId);
        return ResponseEntity.ok(Map.of("deleted", deleted));
    }

    @GetMapping("/stream")
    public SseEmitter subscribe(
        @RequestHeader(name = "Authorization", required = false) String authorization,
        @RequestParam(name = "token", required = false) String token
    ) {
        Long userId = extractUserIdFromAuthorizationOrToken(authorization, token);
        return notificationStreamService.subscribe(userId);
    }

    // Endpoint auxiliar para QA mientras se integran módulos sociales.
    @PostMapping("/test")
    public ResponseEntity<NotificationResponseDto> createTestNotification(
        @RequestHeader(name = "Authorization", required = false) String authorization,
        @RequestBody(required = false) TestNotificationRequest request
    ) {
        Long userId = extractUserIdFromAuthorization(authorization);
        NotificationType type = request != null && request.type != null ? request.type : NotificationType.SYSTEM;
        Map<String, Object> data = Map.of(
            "title", request != null && request.title != null ? request.title : "Notificación de prueba",
            "message", request != null && request.message != null ? request.message : "Sistema de notificaciones en tiempo real activo.",
            "link", request != null && request.link != null ? request.link : "/"
        );

        return ResponseEntity.ok(notificationService.createNotification(userId, type, data));
    }

    private Long extractUserIdFromAuthorizationOrToken(String authorization, String token) {
        if (authorization != null && authorization.startsWith("Bearer ")) {
            return extractUserIdFromAuthorization(authorization);
        }
        if (token == null || token.isBlank()) {
            throw new ResponseStatusException(UNAUTHORIZED, "Missing token");
        }
        return authService.getUserId(token)
            .orElseThrow(() -> new ResponseStatusException(UNAUTHORIZED, "Invalid token"));
    }

    private Long extractUserIdFromAuthorization(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new ResponseStatusException(UNAUTHORIZED, "Missing token");
        }

        String token = authorization.substring("Bearer ".length());
        return authService.getUserId(token)
            .orElseThrow(() -> new ResponseStatusException(UNAUTHORIZED, "Invalid token"));
    }

    public static class TestNotificationRequest {
        public NotificationType type;
        public String title;
        public String message;
        public String link;
    }
}
