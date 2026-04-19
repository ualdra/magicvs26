package com.magicvs.backend.controller;

import com.magicvs.backend.model.User;
import com.magicvs.backend.repository.RegistroRepository;
import com.magicvs.backend.service.AuthService;
import com.magicvs.backend.service.GoogleAuthService;
import com.magicvs.backend.service.RegistrationVerificationService;
import com.magicvs.backend.service.UsernameService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/oauth")
public class OAuthController {

    private final GoogleAuthService googleAuthService;
    private final UsernameService usernameService;
    private final RegistroRepository registroRepository;
    private final AuthService authService;
    private final RegistrationVerificationService verificationService;
    private final BCryptPasswordEncoder passwordEncoder;

    private static final String TAG_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    public OAuthController(GoogleAuthService googleAuthService,
                           UsernameService usernameService,
                           RegistroRepository registroRepository,
                           AuthService authService,
                           RegistrationVerificationService verificationService) {
        this.googleAuthService = googleAuthService;
        this.usernameService = usernameService;
        this.registroRepository = registroRepository;
        this.authService = authService;
        this.verificationService = verificationService;
        this.passwordEncoder = new BCryptPasswordEncoder();
    }

    /**
     * Step 1: Frontend sends the Google ID Token.
     * Logic:
     * - Verify token.
     * - Check if user already exists by googleId (Log in directly).
     * - Check if email exists (Link account and Log in).
     * - If completely new, return the pre-filled data for confirmation.
     */
    @PostMapping("/google")
    public ResponseEntity<?> verifyGoogle(@RequestBody Map<String, String> body) {
        String idToken = body.get("idToken");
        if (idToken == null || idToken.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Token missing"));
        }

        GoogleAuthService.GoogleUserInfo info = googleAuthService.verifyToken(idToken);
        if (info == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Invalid Google Token"));
        }

        // 1. Check if googleId already linked
        Optional<User> existingByGoogleId = registroRepository.findByGoogleId(info.getGoogleId());
        if (existingByGoogleId.isPresent()) {
            return loginUser(existingByGoogleId.get());
        }

        // 2. Check if email exists (Automatic linking)
        Optional<User> existingByEmail = registroRepository.findByEmail(info.getEmail());
        if (existingByEmail.isPresent()) {
            User userToLink = existingByEmail.get();
            userToLink.setGoogleId(info.getGoogleId());
            registroRepository.save(userToLink);
            return loginUser(userToLink);
        }

        // 3. Completely new user. Return pre-fill data.
        String generatedUsername = usernameService.generateUniqueUsername(info.getName());

        return ResponseEntity.ok(Map.of(
                "isNewUser", true,
                "email", info.getEmail(),
                "username", generatedUsername,
                "displayName", info.getName(),
                "googleId", info.getGoogleId()
        ));
    }

    /**
     * Step 2: Finalize registration.
     * This will now trigger the email verification flow instead of creating the user directly.
     */
    @PostMapping("/register")
    public ResponseEntity<?> registerOAuth(@RequestBody OAuthRegisterRequest request) {
        if (registroRepository.existsByUsername(request.username)) {
            return ResponseEntity.badRequest().body(Map.of("message", "Username already in use"));
        }

        // Generate a random password that meets requirements: 8-12 chars, 1 Upeer, 1 Num, 1 Symbol
        String randomPassword = generateSecureRandomPassword();

        try {
            var pending = verificationService.initiate(
                    request.username, 
                    request.email, 
                    randomPassword, 
                    request.displayName, 
                    request.googleId
            );
            return ResponseEntity.ok(Map.of("pendingId", pending.getId()));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("message", ex.getMessage()));
        }
    }

    private String generateSecureRandomPassword() {
        // Requirements: 8-12 chars, 1 Uppercase, 1 Digit, 1 Special
        String upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        String lower = "abcdefghijkmnopqrstuvwxyz";
        String digits = "23456789";
        String symbols = "!@#$%^&*()_+";
        
        StringBuilder password = new StringBuilder();
        password.append(upper.charAt(RANDOM.nextInt(upper.length())));
        password.append(digits.charAt(RANDOM.nextInt(digits.length())));
        password.append(symbols.charAt(RANDOM.nextInt(symbols.length())));
        
        String all = upper + lower + digits + symbols;
        for (int i = 0; i < 7; i++) {
            password.append(all.charAt(RANDOM.nextInt(all.length())));
        }
        
        // Final length 10.
        return password.toString();
    }

    private ResponseEntity<?> loginUser(User user) {
        // Update online status
        user.setIsOnline(true);
        user.setLastSeenAt(java.time.LocalDateTime.now());
        registroRepository.save(user);
        
        String token = authService.createSession(user.getId());
        UserController.UserResponse resp = UserController.UserResponse.fromEntity(user);
        resp.token = token;
        return ResponseEntity.ok(resp);
    }

    private String generateFriendTag() {
        String tag;
        do {
            StringBuilder sb = new StringBuilder(6);
            for (int i = 0; i < 6; i++)
                sb.append(TAG_CHARS.charAt(RANDOM.nextInt(TAG_CHARS.length())));
            tag = sb.toString();
        } while (registroRepository.existsByFriendTag(tag));
        return tag;
    }

    public static class OAuthRegisterRequest {
        public String username;
        public String email;
        public String password;
        public String displayName;
        public String googleId;
    }
}
