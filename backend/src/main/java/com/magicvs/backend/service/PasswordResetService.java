package com.magicvs.backend.service;

import com.magicvs.backend.model.PasswordResetToken;
import com.magicvs.backend.model.User;
import com.magicvs.backend.repository.PasswordResetRepository;
import com.magicvs.backend.repository.RegistroRepository;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Service
public class PasswordResetService {

    private static final Logger logger = LoggerFactory.getLogger(PasswordResetService.class);

    private final PasswordResetRepository tokenRepository;
    private final RegistroRepository userRepository;
    private final JavaMailSender mailSender;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public PasswordResetService(PasswordResetRepository tokenRepository, RegistroRepository userRepository, JavaMailSender mailSender) {
        this.tokenRepository = tokenRepository;
        this.userRepository = userRepository;
        this.mailSender = mailSender;
    }

    @Transactional
    public void createPasswordResetTokenForUser(String email) {
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            return; // No mostramos si el email existe o no por seguridad, pero no enviamos nada
        }

        User user = userOpt.get();
        
        // Limpiamos tokens anteriores del mismo usuario
        tokenRepository.deleteByUser(user);

        String token = UUID.randomUUID().toString();
        PasswordResetToken myToken = new PasswordResetToken(token, user, 15); // Expira en 15 min
        tokenRepository.save(myToken);

        sendResetTokenEmail(user, token);
    }

    private void sendResetTokenEmail(User user, String token) {
        try {
            String fromAddress = System.getenv("SMTP_FROM") != null ? System.getenv("SMTP_FROM") : "noreply@magicvs.local";
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");

            helper.setTo(user.getEmail());
            helper.setFrom(fromAddress);
            helper.setSubject("🔑 Recupera tu acceso a MagicVS");

            String resetUrl = "http://localhost:4200/reset-password/" + token;

            String htmlContent = "<!DOCTYPE html><html><head>" +
                    "<meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'>" +
                    "<link href='https://fonts.googleapis.com/css2?family=Poppins:wght@700&display=swap' rel='stylesheet'>" +
                    "<style>" +
                    "  body { background-color: #000000 !important; color: #e5e2e1 !important; font-family: 'Poppins', sans-serif; margin: 0; padding: 0; }" +
                    "</style></head>" +
                    "<body>" +
                    "  <table width='100%' border='0' cellspacing='0' cellpadding='0' style='background-color: #000000; padding: 40px 10px;'>" +
                    "    <tr><td align='center'>" +
                    "      <table width='100%' style='max-width: 500px;' border='0' cellspacing='0' cellpadding='0'>" +
                    "        <tr><td style='padding-bottom: 40px; text-align: left;'>" +
                    "          <span style='color: #ffffff !important; font-size: 20px; font-weight: 900; letter-spacing: 5px;'>MAGICVS</span>" +
                    "        </td></tr>" +
                    "        <tr><td class='card-bg' style='background-color: #121212 !important; border: 1px solid #222222; border-radius: 24px; padding: 60px 30px; text-align: center;'>" +
                    "          <div style='text-align: center; margin-bottom: 30px;'><img src='cid:logo' width='220' alt='MagicVS Logo' style='display: inline-block; border: 0;'></div>" +
                    "          <h2 style='color: #ffffff; font-size: 32px; margin: 0 0 15px 0; font-weight: 800;'>¿Olvidaste tu contraseña?</h2>" +
                    "          <p style='color: #a1a1aa; font-size: 15px; line-height: 1.6; margin-bottom: 40px;'>No te preocupes, incluso los grandes magos pierden su memoria a veces. Haz clic en el botón de abajo para restablecer tu contraseña:</p>" +
                    "          <a href='" + resetUrl + "' style='display: inline-block; background-color: #ecb2ff; color: #2e0040; padding: 18px 45px; border-radius: 12px; text-decoration: none; font-weight: 900; font-size: 13px; text-transform: uppercase;'>Restablecer Contraseña</a>" +
                    "          <p style='color: #52525b; font-size: 12px; margin-top: 30px;'>• Este enlace caducará en 15 minutos.<br>• Si no solicitaste este cambio, simplemente ignora este correo.</p>" +
                    "        </td></tr>" +
                    "        <tr><td style='padding: 50px 0; text-align: center;'>" +
                    "          <div style='color: #52525b; font-size: 10px; text-transform: uppercase; letter-spacing: 2px;'>© 2026 MAGICVS ARCANE SYSTEMS</div>" +
                    "        </td></tr>" +
                    "      </table>" +
                    "    </td></tr>" +
                    "  </table>" +
                    "</body></html>";

            helper.setText(htmlContent, true);
            helper.addInline("logo", new ClassPathResource("static/images/icono.webp"));
            mailSender.send(mimeMessage);

        } catch (Exception ex) {
            logger.error("Error sending password reset email to {}", user.getEmail(), ex);
        }
    }

    public boolean validatePasswordResetToken(String token) {
        Optional<PasswordResetToken> passToken = tokenRepository.findByToken(token);
        return passToken.isPresent() && !passToken.get().isExpired();
    }

    @Transactional
    public void resetPassword(String token, String newPassword) {
        Optional<PasswordResetToken> passToken = tokenRepository.findByToken(token);
        if (passToken.isEmpty() || passToken.get().isExpired()) {
            throw new IllegalArgumentException("Token inválido o expirado");
        }

        User user = passToken.get().getUser();
        String updatedPasswordHash = passwordEncoder.encode(newPassword);
        user.setPasswordHash(updatedPasswordHash);
        userRepository.save(user);

        tokenRepository.delete(passToken.get());
    }
}
