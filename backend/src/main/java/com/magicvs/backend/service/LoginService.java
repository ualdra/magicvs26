package com.magicvs.backend.service;

import com.magicvs.backend.model.User;
import com.magicvs.backend.repository.LoginRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Locale;
import com.magicvs.backend.util.ValidationUtils;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

@Service
public class LoginService {

    private final LoginRepository loginRepository;

    public LoginService(LoginRepository loginRepository) {
        this.loginRepository = loginRepository;
    }

    public User login(String usernameOrEmail, String password) {
        String value = usernameOrEmail.trim();

        if (!ValidationUtils.isUsernameOrEmail(value)) {
            throw new IllegalArgumentException("Formato de usuario o email inválido");
        }

        User user = loginRepository.findByUsername(value)
                .or(() -> loginRepository.findByEmail(value.toLowerCase(Locale.ROOT)))
                .orElseThrow(() -> new IllegalArgumentException("Credenciales incorrectas"));

        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        if (!encoder.matches(password, user.getPasswordHash())) {
            throw new IllegalArgumentException("Credenciales incorrectas");
        }

        // Update online status
        user.setIsOnline(true);
        user.setLastSeenAt(LocalDateTime.now());
        loginRepository.save(user);

        return user;
    }

    public boolean existsByUsernameOrEmail(String usernameOrEmail) {
        String value = usernameOrEmail.trim();
        boolean byUsername = loginRepository.findByUsername(value).isPresent();
        boolean byEmail = loginRepository.findByEmail(value.toLowerCase(Locale.ROOT)).isPresent();
        return byUsername || byEmail;
    }
}
