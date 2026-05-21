package com.magicvs.backend.controller;

import com.magicvs.backend.dto.BlockedUserDTO;
import com.magicvs.backend.service.AuthService;
import com.magicvs.backend.service.BlockService;
import com.magicvs.backend.repository.RegistroRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/blocks")
public class BlockController {

    private final BlockService blockService;
    private final AuthService authService;
    private final RegistroRepository userRepository;

    public BlockController(BlockService blockService, AuthService authService, RegistroRepository userRepository) {
        this.blockService = blockService;
        this.authService = authService;
        this.userRepository = userRepository;
    }

    /**
     * Bloquea a un usuario.
     * Endpoint: POST /api/blocks/{targetId}
     */
    @PostMapping("/{targetId}")
    public ResponseEntity<?> blockUser(@RequestHeader(value = "Authorization", required = false) String token, 
                                       @PathVariable Long targetId) {
        System.out.println("BlockController: Intentando bloquear targetId=" + targetId + " con token=" + (token != null ? "presente" : "null"));
        Long userId = getUserIdFromToken(token);
        System.out.println("BlockController: userId extraído=" + userId);
        // Evitar que un usuario se bloquee a sí mismo
        if (userId != null && userId.equals(targetId)) {
            return ResponseEntity.badRequest().body(Map.of("error", "No puedes bloquearte a ti mismo."));
        }

        try {
            blockService.blockUser(userId, targetId);
            System.out.println("BlockController: Bloqueo exitoso");
            return ResponseEntity.ok(Map.of(
                "message", "Usuario bloqueado correctamente y amistad eliminada."
            ));
        } catch (Exception e) {
            System.out.println("BlockController: Error al bloquear: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Desbloquea a un usuario.
     * Endpoint: DELETE /api/blocks/{targetId}
     */
    @DeleteMapping("/{targetId}")
    public ResponseEntity<?> unblockUser(@RequestHeader(value = "Authorization", required = false) String token, 
                                         @PathVariable Long targetId) {
        Long userId = getUserIdFromToken(token);
        // Evitar que un usuario intente desbloquearse a sí mismo (no aplicable, pero por seguridad)
        if (userId != null && userId.equals(targetId)) {
            return ResponseEntity.badRequest().body(Map.of("error", "No puedes desbloquearte a ti mismo."));
        }

        try {
            blockService.unblockUser(userId, targetId);
            return ResponseEntity.ok(Map.of("message", "Has desbloqueado al usuario."));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Lista los usuarios bloqueados por el usuario autenticado.
     * Endpoint: GET /api/blocks
     */
    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<BlockedUserDTO>> getMyBlockedList(@RequestHeader(value = "Authorization", required = false) String token) {
        Long userId = getUserIdFromToken(token);
        
        List<BlockedUserDTO> blockedUsers = userRepository.findById(userId)
                .map(user -> user.getBlockedUsers().stream()
                        .map(u -> new BlockedUserDTO(u.getId(), u.getUsername()))
                        .collect(Collectors.toList()))
                .orElse(Collections.emptyList());

        return ResponseEntity.ok(blockedUsers);
    }

    /**
     * Método privado para extraer el ID de usuario del token JWT de forma segura.
     */
    private Long getUserIdFromToken(String token) {
        if (token == null || !token.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Token no proporcionado");
        }
        return authService.getUserId(token.replace("Bearer ", ""))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Token inválido o expirado"));
    }
}