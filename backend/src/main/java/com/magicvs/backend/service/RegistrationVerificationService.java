package com.magicvs.backend.service;

import com.magicvs.backend.model.PendingRegistration;
import com.magicvs.backend.model.User;
import com.magicvs.backend.repository.PendingRegistrationRepository;
import com.magicvs.backend.repository.RegistroRepository;
import com.magicvs.backend.util.ValidationUtils;
import org.springframework.mail.javamail.MimeMessageHelper;
import jakarta.mail.internet.MimeMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;

import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Optional;
import java.security.SecureRandom;

@Service
public class RegistrationVerificationService {

    private static final Logger logger = LoggerFactory.getLogger(RegistrationVerificationService.class);

    private final PendingRegistrationRepository pendingRepo;
    private final RegistroRepository registroRepository;
    private final JavaMailSender mailSender;

    private static final String TAG_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    public RegistrationVerificationService(PendingRegistrationRepository pendingRepo,
            RegistroRepository registroRepository, JavaMailSender mailSender) {
        this.pendingRepo = pendingRepo;
        this.registroRepository = registroRepository;
        this.mailSender = mailSender;
    }

    public PendingRegistration initiate(String username, String email, String rawPassword, String displayName, String googleId) {
        String normalizedUsername = username.trim();
        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);

        logger.info("[DIAGNOSTIC] Iniciando registro. Usuario: {}, Email destino: {}", normalizedUsername,
                normalizedEmail);

        if (!ValidationUtils.isValidUsername(normalizedUsername)) {
            throw new IllegalArgumentException("Nombre de usuario inválido");
        }
        if (!ValidationUtils.isValidEmail(normalizedEmail)) {
            throw new IllegalArgumentException("Email con formato inválido");
        }
        if (!ValidationUtils.isValidPassword(rawPassword)) {
            throw new IllegalArgumentException("Contraseña inválida");
        }
        if (registroRepository.existsByUsername(normalizedUsername)) {
            throw new IllegalArgumentException("El nombre de usuario ya está en uso");
        }
        if (registroRepository.existsByEmail(normalizedEmail)) {
            throw new IllegalArgumentException("El email ya está en uso");
        }

        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        String passwordHash = encoder.encode(rawPassword);

        String code = generateNumericCode(6);
        String codeHash = encoder.encode(code);

        PendingRegistration pr = new PendingRegistration();
        pr.setUsername(normalizedUsername);
        pr.setEmail(normalizedEmail);
        pr.setPasswordHash(passwordHash);
        pr.setDisplayName(ValidationUtils.sanitizeDisplayName(displayName != null ? displayName : ""));
        pr.setVerificationHash(codeHash);
        pr.setExpiresAt(LocalDateTime.now().plusMinutes(15));
        pr.setGoogleId(googleId);

        PendingRegistration saved = pendingRepo.save(pr);

        try {
            String fromAddress = System.getenv("SMTP_FROM") != null ? System.getenv("SMTP_FROM")
                    : "noreply@magicvs.local";
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");

            helper.setTo(normalizedEmail);
            helper.setFrom(fromAddress);
            helper.setSubject("⚔️ ¡Ya casi estás! Tu código de activación para MagicVS");

            String formattedCode = code;

            String htmlContent = "<!DOCTYPE html><html><head>" +
                    "<meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'>" +
    "<link href='https://fonts.googleapis.com/css2?family=Poppins:wght@700&display=swap' rel='stylesheet'>" +
    "<style>" +
    "  body { background-color: #000000 !important; color: #e5e2e1 !important; font-family: 'Poppins', sans-serif; margin: 0; padding: 0; }" +
    "  .card-bg { background-color: #121212 !important; border: 1px solid #222222; border-radius: 24px; padding: 60px 30px; text-align: center; }" +
    "</style></head>" +
                    "<body>" +
                    "  <table width='100%' border='0' cellspacing='0' cellpadding='0' style='background-color: #000000; padding: 40px 10px;'>"
                    +
                    "    <tr><td align='center'>" +
                    "      <table width='100%' style='max-width: 500px;' border='0' cellspacing='0' cellpadding='0'>" +
                    "        <tr><td style='padding-bottom: 40px; text-align: left;'>" +
                    "          <span style='color: #ffffff !important; font-size: 20px; font-weight: 900; letter-spacing: 5px;'>MAGICVS</span>"
                    +
                    "        </td></tr>" +
                    "          <div style='text-align: center; margin-bottom: 30px;'><img src='cid:logo' width='220' alt='MagicVS Logo' style='display: inline-block; border: 0;'></div>" +
                    "          <h2 style='color: #ffffff; font-size: 32px; margin: 0 0 15px 0; font-weight: 800;'>Verifica tu chispa</h2>" +
                    "          <p style='color: #a1a1aa; font-size: 15px; line-height: 1.6; margin-bottom: 40px;'>Estás a un paso de dominar el Multiverso. Usa el código para completar tu registro:</p>" +
                    "          <div style='background-color: #000000; border: 1px solid #333333; padding: 30px 20px; border-radius: 16px; margin-bottom: 40px; text-align: center;'>" +
                    "            <span style='font-size: 48px; font-weight: 900; letter-spacing: 12px; color: #ffffff !important; font-family: monospace; display: block;'>" + 
                    formattedCode + "</span>" +
                    "          </div>" +
                    "          <a href='http://localhost:4200/verify/" + saved.getId()
                    + "' style='display: inline-block; background-color: #ecb2ff; color: #2e0040; padding: 18px 45px; border-radius: 12px; text-decoration: none; font-weight: 900; font-size: 13px; text-transform: uppercase;'>Confirmar Registro</a>"
                    +
                    "          <p style='color: #52525b; font-size: 12px; margin-top: 30px;'>• El código caducará en 15 minutos.</p>"
                    +
                    "        </td></tr>" +
                    "        <tr><td style='padding: 50px 0; text-align: center;'>" +
                    "          <div style='color: #52525b; font-size: 10px; text-transform: uppercase; letter-spacing: 2px;'>© 2026 MAGICVS ARCANE SYSTEMS</div>"
                    +
                    "        </td></tr>" +
                    "      </table>" +
                    "    </td></tr>" +
                    "  </table>" +
                    "</body></html>";

            helper.setText(htmlContent, true);
            helper.addInline("logo", new ClassPathResource("static/images/icono.webp"));
            mailSender.send(mimeMessage);

        } catch (Exception ex) {
            logger.error("Error sending verification email", ex);
            pendingRepo.delete(saved);
            throw new RuntimeException("No se pudo enviar el email: " + ex.getMessage());
        }
        return saved;
    }

    public User confirm(Long pendingId, String code) {
        Optional<PendingRegistration> opt = pendingRepo.findById(pendingId);
        if (opt.isEmpty())
            throw new IllegalArgumentException("Registro no encontrado");

        PendingRegistration pr = opt.get();
        if (pr.getExpiresAt().isBefore(LocalDateTime.now())) {
            pendingRepo.delete(pr);
            throw new IllegalArgumentException("Código expirado");
        }

        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        if (!encoder.matches(code, pr.getVerificationHash())) {
            pr.setAttempts(pr.getAttempts() + 1);
            pendingRepo.save(pr);
            throw new IllegalArgumentException("Código incorrecto");
        }

        User user = new User();
        user.setUsername(pr.getUsername());
        user.setEmail(pr.getEmail());
        user.setPasswordHash(pr.getPasswordHash());
        user.setDisplayName(pr.getDisplayName().isBlank() ? pr.getUsername() : pr.getDisplayName());
        user.setFriendTag(generateFriendTag());
        user.setGoogleId(pr.getGoogleId());

        User savedUser = registroRepository.save(user);
        pendingRepo.delete(pr);

        try {
            String fromAddress = System.getenv("SMTP_FROM") != null ? System.getenv("SMTP_FROM")
                    : "noreply@magicvs.local";
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");

            helper.setTo(savedUser.getEmail());
            helper.setFrom(fromAddress);
            helper.setSubject("✨ ¡Bienvenido oficialmente, " + savedUser.getDisplayName() + "!");

            String welcomeHtml = "<!DOCTYPE html><html><body style='background-color: #000000; color: #e5e2e1; font-family: sans-serif; text-align: center;'>"
                    +
                    "<div style='padding: 40px;'>" +
                    "  <div style='text-align: center; margin-bottom: 30px;'><img src='cid:logo' width='220' alt='MagicVS Logo' style='display: inline-block; border: 0;'></div>" +
                    "  <h2 style='color: #ffffff; font-size: 30px;'>¡Bienvenido, Caminante!</h2>" +
                    "  <p>Tu cuenta ha sido activada con éxito. Ya puedes entrar a la Arena.</p>" +
                    "  <br><a href='http://localhost:4200' style='background-color: #ecb2ff; color: #2e0040; padding: 15px 35px; border-radius: 10px; text-decoration: none; font-weight: bold;'>ENTRAR A MAGICVS</a>"
                    +
                    "</div></body></html>";

            helper.setText(welcomeHtml, true);
            helper.addInline("logo", new ClassPathResource("static/images/icono.webp"));
            mailSender.send(mimeMessage);
        } catch (Exception e) {
            logger.warn("Error enviando bienvenida a {}", savedUser.getEmail());
        }

        return savedUser;
    }

    private String generateNumericCode(int len) {
        StringBuilder sb = new StringBuilder(len);
        for (int i = 0; i < len; i++)
            sb.append(RANDOM.nextInt(10));
        return sb.toString();
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
}