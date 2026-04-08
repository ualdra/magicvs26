package com.magicvs.backend.controller;

import com.magicvs.backend.model.User;
import com.magicvs.backend.service.RegistroService;
import com.magicvs.backend.service.LoginService;
import com.magicvs.backend.service.AuthService;
import com.magicvs.backend.repository.RegistroRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@CrossOrigin(origins = "http://localhost:4200")
@RequestMapping("/api/users")
public class UserController {

    private final RegistroService registroService;
    private final LoginService loginService;
    private final AuthService authService;
    private final RegistroRepository registroRepository;

    public UserController(RegistroService registroService, LoginService loginService, AuthService authService, RegistroRepository registroRepository) {
        this.registroService = registroService;
        this.loginService = loginService;
        this.authService = authService;
        this.registroRepository = registroRepository;
    }

    // ---- Endpoints expuestos para Registro y Login ----

    @PostMapping("/register")
    public ResponseEntity<UserResponse> register(@RequestBody RegistroRequest request) {
        try {
            User user = registroService.registrar(request.username, request.email, request.password, request.displayName);
            String token = authService.createSession(user.getId());
            UserResponse resp = UserResponse.fromEntity(user);
            resp.token = token;
            return ResponseEntity.status(HttpStatus.CREATED).body(resp);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage());
        }
    }

    @PostMapping("/login")
    public ResponseEntity<UserResponse> login(@RequestBody LoginRequest request) {
        try {
            User user = loginService.login(request.usernameOrEmail, request.password);
            String token = authService.createSession(user.getId());
            UserResponse resp = UserResponse.fromEntity(user);
            resp.token = token;
            return ResponseEntity.ok(resp);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, ex.getMessage());
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

        public static UserResponse fromEntity(User user) {
            UserResponse resp = new UserResponse();
            resp.id = user.getId();
            resp.username = user.getUsername();
            resp.email = user.getEmail();
            resp.displayName = user.getDisplayName();
            resp.friendTag = user.getFriendTag();
            resp.eloRating = user.getEloRating();
            resp.friendsCount = user.getFriendsCount();
            return resp;
        }
    }
}
