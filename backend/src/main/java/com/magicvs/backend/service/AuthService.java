package com.magicvs.backend.service;

import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AuthService {

    private final Map<String, Long> sessions = new ConcurrentHashMap<>();
    private static final SecureRandom RANDOM = new SecureRandom();

    public String createSession(Long userId) {
        byte[] bytes = new byte[24];
        RANDOM.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        sessions.put(token, userId);
        return token;
    }

    public Optional<Long> getUserId(String token) {
        if (token == null) return Optional.empty();
        return Optional.ofNullable(sessions.get(token));
    }

    public void invalidate(String token) {
        sessions.remove(token);
    }
}
