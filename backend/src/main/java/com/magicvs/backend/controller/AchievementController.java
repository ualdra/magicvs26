package com.magicvs.backend.controller;

import com.magicvs.backend.dto.AchievementDto;
import com.magicvs.backend.dto.UserAchievementDto;
import com.magicvs.backend.model.User;
import com.magicvs.backend.repository.RegistroRepository;
import com.magicvs.backend.service.AchievementService;
import com.magicvs.backend.service.AuthService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@CrossOrigin(origins = "http://localhost:4200")
@RequestMapping("/api/achievements")
public class AchievementController {

    private final AchievementService achievementService;
    private final AuthService authService;
    private final RegistroRepository userRepository;

    public AchievementController(AchievementService achievementService,
                                  AuthService authService,
                                  RegistroRepository userRepository) {
        this.achievementService = achievementService;
        this.authService = authService;
        this.userRepository = userRepository;
    }

    // Catálogo completo de logros
    @GetMapping
    public ResponseEntity<List<AchievementDto>> getAllAchievements() {
        List<AchievementDto> dtos = achievementService.getAllAchievements()
                .stream()
                .map(AchievementDto::fromEntity)
                .toList();
        return ResponseEntity.ok(dtos);
    }

    // Logros del jugador autenticado (con progreso)
    @GetMapping("/me")
    public ResponseEntity<List<UserAchievementDto>> getMyAchievements(
            @RequestHeader(name = "Authorization", required = false) String authorization) {
        User user = extractUser(authorization);
        List<UserAchievementDto> dtos = achievementService.getUserAchievements(user)
                .stream()
                .map(UserAchievementDto::fromEntity)
                .toList();
        return ResponseEntity.ok(dtos);
    }

    // Logros de cualquier jugador por su ID (solo los desbloqueados)
    @GetMapping("/user/{userId}")
    public ResponseEntity<List<UserAchievementDto>> getUserAchievements(@PathVariable Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        List<UserAchievementDto> dtos = achievementService.getUnlockedAchievements(user)
                .stream()
                .map(UserAchievementDto::fromEntity)
                .toList();
        return ResponseEntity.ok(dtos);
    }

    // Gana un logro manualmente (para pruebas)
    @PostMapping("/earn/{key}")
    public ResponseEntity<UserAchievementDto> earn(
            @RequestHeader(name = "Authorization", required = false) String authorization,
            @PathVariable String key) {
        User user = extractUser(authorization);
        achievementService.increment(user, key);
        return achievementService.getUserAchievements(user).stream()
                .filter(ua -> ua.getAchievement().getAchievementKey().equals(key))
                .findFirst()
                .map(ua -> ResponseEntity.ok(UserAchievementDto.fromEntity(ua)))
                .orElse(ResponseEntity.notFound().build());
    }

    private User extractUser(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Token requerido");
        }
        Long userId = authService.getUserId(authorization.substring(7))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Token inválido"));
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
    }
}
