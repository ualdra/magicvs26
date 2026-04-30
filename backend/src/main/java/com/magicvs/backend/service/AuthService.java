package com.magicvs.backend.service;

import com.magicvs.backend.repository.LoginRepository;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AuthService {

    private final Map<String, Long> sessions = new ConcurrentHashMap<>();
    private static final SecureRandom RANDOM = new SecureRandom();

    private final LoginRepository loginRepository;

    public AuthService(LoginRepository loginRepository) {
        this.loginRepository = loginRepository;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void resetOnlineStatusOnStartup() {
        loginRepository.resetAllOnlineStatus();
    }

    @Transactional
    public String createSession(Long userId) {
        byte[] bytes = new byte[24];
        RANDOM.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        sessions.put(token, userId);
        loginRepository.findById(userId).ifPresent(user -> {
            user.setIsOnline(true);
            user.setLastSeenAt(LocalDateTime.now());
            loginRepository.save(user);
        });
        return token;
    }

    public Optional<Long> getUserId(String token) {
        if (token == null) return Optional.empty();
        return Optional.ofNullable(sessions.get(token));
    }

    @Transactional
    public void logout(String token) {
        Long userId = sessions.remove(token);
        if (userId != null) {
            loginRepository.findById(userId).ifPresent(user -> {
                user.setIsOnline(false);
                user.setLastSeenAt(LocalDateTime.now());
                loginRepository.save(user);
            });
        }
    }

    public void invalidate(String token) {
        sessions.remove(token);
    }
}
