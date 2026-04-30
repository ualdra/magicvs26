package com.magicvs.backend.service;

import com.magicvs.backend.model.User;
import com.magicvs.backend.repository.RegistroRepository;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.Locale;
import com.magicvs.backend.util.ValidationUtils;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

@Service
public class RegistroService {

    private final RegistroRepository registroRepository;

    private static final String TAG_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    public RegistroService(RegistroRepository registroRepository) {
        this.registroRepository = registroRepository;
    }

    public User registrar(String username, String email, String password, String displayName) {
        if (username == null || email == null || password == null) {
            throw new IllegalArgumentException("Faltan campos obligatorios");
        }

        String normalizedUsername = username.trim();
        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);

        if (!ValidationUtils.isValidUsername(normalizedUsername)) {
            throw new IllegalArgumentException("Nombre de usuario inválido. Solo letras (A-Z, a-z), guion bajo o guion medio (3-16 caracteres)");
        }
        if (!ValidationUtils.isValidEmail(normalizedEmail)) {
            throw new IllegalArgumentException("Email con formato inválido");
        }
        if (!ValidationUtils.isValidPassword(password)) {
            throw new IllegalArgumentException("La contraseña debe tener entre 8 y 12 caracteres, al menos una mayúscula, un número y un símbolo");
        }
        if (ValidationUtils.containsMaliciousPayload(normalizedUsername) || ValidationUtils.containsMaliciousPayload(normalizedEmail) || ValidationUtils.containsMaliciousPayload(displayName)) {
            throw new IllegalArgumentException("Entrada sospechosa detectada");
        }

        // Validate displayName (apodo): disallow spaces and special characters
        if (displayName != null && !displayName.isBlank()) {
            if (!ValidationUtils.isValidDisplayName(displayName)) {
                throw new IllegalArgumentException("Nombre visible inválido. El apodo no puede contener espacios ni caracteres especiales");
            }
        }

        if (registroRepository.existsByUsername(normalizedUsername)) {
            throw new IllegalArgumentException("El nombre de usuario ya está en uso");
        }
        if (registroRepository.existsByEmail(normalizedEmail)) {
            throw new IllegalArgumentException("El email ya está en uso");
        }

        User user = new User();
        user.setUsername(normalizedUsername);
        user.setEmail(normalizedEmail);
        // Hash password with BCrypt
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        user.setPasswordHash(encoder.encode(password));
        String safeDisplay = ValidationUtils.sanitizeDisplayName(displayName != null ? displayName : "");
        user.setDisplayName(!safeDisplay.isBlank() ? safeDisplay : normalizedUsername);

        // Generar friendTag tipo Discord (letras y números), único por usuario
        user.setFriendTag(generateFriendTag());
        user.setManualRegistration(true);

        return registroRepository.save(user);
    }

    private String generateFriendTag() {
        int length = 6; // por ejemplo: 6 caracteres tipo ABC123
        String tag;
        do {
            StringBuilder sb = new StringBuilder(length);
            for (int i = 0; i < length; i++) {
                int idx = RANDOM.nextInt(TAG_CHARS.length());
                sb.append(TAG_CHARS.charAt(idx));
            }
            tag = sb.toString();
        } while (registroRepository.existsByFriendTag(tag));

        return tag;
    }
}
