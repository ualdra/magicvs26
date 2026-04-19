package com.magicvs.backend.controller;

import com.magicvs.backend.model.User;
import com.magicvs.backend.service.RegistroService;
import com.magicvs.backend.service.LoginService;
import com.magicvs.backend.service.AuthService;
import com.magicvs.backend.repository.RegistroRepository;
import com.magicvs.backend.dto.UserDirectoryResponseDto;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final RegistroService registroService;
    private final LoginService loginService;
    private final AuthService authService;
    private final RegistroRepository registroRepository;
    private final com.magicvs.backend.service.RegistrationVerificationService verificationService;

    public UserController(RegistroService registroService, LoginService loginService, AuthService authService, RegistroRepository registroRepository, com.magicvs.backend.service.RegistrationVerificationService verificationService) {
        this.registroService = registroService;
        this.loginService = loginService;
        this.authService = authService;
        this.registroRepository = registroRepository;
        this.verificationService = verificationService;
    }

    @GetMapping("/exists")
    public ResponseEntity<Map<String, Boolean>> exists(@RequestParam(name = "usernameOrEmail") String usernameOrEmail) {
        String value = usernameOrEmail.trim();
        boolean exists = loginService.existsByUsernameOrEmail(value);
        return ResponseEntity.ok(Map.of("exists", exists));
    }

    @GetMapping
    public ResponseEntity<List<UserDirectoryResponseDto>> getAllUsers() {
        List<UserDirectoryResponseDto> users = registroRepository.findAll().stream()
                .filter(User::getActive)
                .map(UserDirectoryResponseDto::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(users);
    }

    // ---- Endpoints expuestos para Registro y Login ----

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegistroRequest request) {
        try {
            User user = registroService.registrar(request.username, request.email, request.password, request.displayName);
            String token = authService.createSession(user.getId());
            UserResponse resp = UserResponse.fromEntity(user);
            resp.token = token;
            return ResponseEntity.status(HttpStatus.CREATED).body(resp);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(java.util.Map.of("message", ex.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        try {
            User user = loginService.login(request.usernameOrEmail, request.password);
            String token = authService.createSession(user.getId());
            UserResponse resp = UserResponse.fromEntity(user);
            resp.token = token;
            return ResponseEntity.ok(resp);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(java.util.Map.of("message", ex.getMessage()));
        }
    }

    @PostMapping("/register/initiate")
    public ResponseEntity<?> initiate(@RequestBody RegistroRequest request) {
        try {
            var pending = verificationService.initiate(request.username, request.email, request.password, request.displayName, null);
            return ResponseEntity.ok(java.util.Map.of("pendingId", pending.getId()));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(java.util.Map.of("message", ex.getMessage()));
        } catch (Exception ex) {
            String msg = ex.getMessage() != null ? ex.getMessage() : "Error interno al iniciar el registro";
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(java.util.Map.of("message", msg));
        }
    }

    @PostMapping("/register/confirm")
    public ResponseEntity<?> confirm(@RequestBody ConfirmRequest request) {
        try {
            User user = verificationService.confirm(request.pendingId, request.code);
            String token = authService.createSession(user.getId());
            UserResponse resp = UserResponse.fromEntity(user);
            resp.token = token;
            return ResponseEntity.status(HttpStatus.CREATED).body(resp);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(java.util.Map.of("message", ex.getMessage()));
        } catch (Exception ex) {
            String msg = ex.getMessage() != null ? ex.getMessage() : "Error interno al confirmar registro";
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(java.util.Map.of("message", msg));
        }
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponse> me(@RequestHeader(name = "Authorization", required = false) String authorization) {
        try {
            if (authorization == null || !authorization.startsWith("Bearer ")) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing token");
            }
            String token = authorization.substring("Bearer ".length());
            Long userId = authService.getUserId(token).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid token"));
            User user = registroRepository.findById(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario no encontrado"));
            UserResponse resp = UserResponse.fromEntity(user);
            resp.token = token;
            return ResponseEntity.ok(resp);
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Error al procesar token");
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestHeader(name = "Authorization", required = false) String authorization) {
        if (authorization != null && authorization.startsWith("Bearer ")) {
            String token = authorization.substring("Bearer ".length());
            
            // Get the user and set offline status
            var userId = authService.getUserId(token);
            if (userId.isPresent()) {
                var user = registroRepository.findById(userId.get());
                if (user.isPresent()) {
                    User loggedOutUser = user.get();
                    loggedOutUser.setIsOnline(false);
                    loggedOutUser.setLastSeenAt(java.time.LocalDateTime.now());
                    registroRepository.save(loggedOutUser);
                }
            }
            
            authService.logout(token);
        }
        return ResponseEntity.ok().build();
    }

    // ---- DTOs para las peticiones y respuestas ----

    public static class RegistroRequest {
        public String username;
        public String email;
        public String password;
        public String displayName;
    }

    public static class LoginRequest {
        public String usernameOrEmail;
        public String password;
    }

    public static class UserResponse {
        public Long id;
        public String username;
        public String email;
        public String displayName;
        public String friendTag;
        public String token;
        public Integer eloRating;
        public Integer friendsCount;
        public Boolean isOnline;
        public String lastSeenAt;

        public static UserResponse fromEntity(User user) {
            UserResponse resp = new UserResponse();
            resp.id = user.getId();
            resp.username = user.getUsername();
            resp.email = user.getEmail();
            resp.displayName = user.getDisplayName();
            resp.friendTag = user.getFriendTag();
            resp.eloRating = user.getEloRating();
            resp.friendsCount = user.getFriendsCount();
            resp.isOnline = user.getIsOnline();
            resp.lastSeenAt = user.getLastSeenAt() != null ? user.getLastSeenAt().toString() : null;
            return resp;
        }
    }

    public static class ConfirmRequest {
        public Long pendingId;
        public String code;
    }
}
