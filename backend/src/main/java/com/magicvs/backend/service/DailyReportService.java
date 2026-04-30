package com.magicvs.backend.service;

import com.magicvs.backend.model.User;
import com.magicvs.backend.model.UserDailyStats;
import com.magicvs.backend.repository.RegistroRepository;
import com.magicvs.backend.repository.UserDailyStatsRepository;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class DailyReportService {

    private static final Logger logger = LoggerFactory.getLogger(DailyReportService.class);

    private final UserDailyStatsRepository dailyStatsRepository;
    private final RegistroRepository userRepository;
    private final JavaMailSender mailSender;

    public DailyReportService(UserDailyStatsRepository dailyStatsRepository, 
                              RegistroRepository userRepository, 
                              JavaMailSender mailSender) {
        this.dailyStatsRepository = dailyStatsRepository;
        this.userRepository = userRepository;
        this.mailSender = mailSender;
    }

    // Se ejecuta según la configuración en application.properties (por defecto 8:00 AM)
    @Scheduled(cron = "${app.daily-report.cron}")
    public void sendDailyReports() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        logger.info("Iniciando envío de reportes diarios para la fecha: {}", yesterday);

        List<UserDailyStats> allStatsYesterday = dailyStatsRepository.findByDate(yesterday);
        Set<Long> userIdsWithActivity = allStatsYesterday.stream()
                .map(stats -> stats.getUser().getId())
                .collect(Collectors.toSet());

        // 1. Enviar a los que SÍ jugaron
        for (UserDailyStats stats : allStatsYesterday) {
            sendEmail(stats.getUser(), stats.getGamesPlayed(), stats.getGamesWon());
        }

        // 2. Enviar a los que NO jugaron
        List<User> allUsers = userRepository.findAll();
        for (User user : allUsers) {
            if (!userIdsWithActivity.contains(user.getId()) && user.getActive()) {
                sendEmail(user, 0, 0);
            }
        }
    }

    private void sendEmail(User user, int played, int won) {
        try {
            String fromAddress = System.getenv("SMTP_FROM") != null ? System.getenv("SMTP_FROM") : "noreply@magicvs.local";
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");

            helper.setTo(user.getEmail());
            helper.setFrom(fromAddress);
            helper.setSubject("📊 Tu resumen diario en MagicVS");

            String title;
            String message;
            String accentColor;
            String buttonText = "¡Jugar ahora!";

            if (played == 0) {
                title = "¡Te echamos de menos!";
                message = "Ayer no vimos actividad en tu cuenta. La arena se siente vacía sin ti. ¿Qué tal si echas una partida hoy?";
                accentColor = "#a1a1aa"; // Gris
            } else {
                double winRate = (double) won / played;
                if (winRate > 0.5) {
                    title = "¡Estás imparable!";
                    message = "Ayer dominaste el campo de batalla con un impresionante desempeño. ¡Sigue así, campeón!";
                    accentColor = "#ecb2ff"; // Lila brillante
                } else {
                    title = "¡Buen intento!";
                    message = "Ayer fue un día de aprendizaje. Cada derrota es un paso más hacia la maestría. ¡Hoy es un buen día para la revancha!";
                    accentColor = "#ffb2b2"; // Rojo suave
                }
            }

            String htmlContent = "<!DOCTYPE html><html><head>" +
                    "<meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'>" +
                    "<link href='https://fonts.googleapis.com/css2?family=Poppins:wght@400;700;900&display=swap' rel='stylesheet'>" +
                    "<style>" +
                    "  body { background-color: #000000; color: #e5e2e1; font-family: 'Poppins', sans-serif; margin: 0; padding: 0; }" +
                    "  .stats-box { background-color: #1a1a1a; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #333; }" +
                    "  .stat-val { font-size: 24px; font-weight: 900; color: " + accentColor + "; }" +
                    "  .stat-label { font-size: 12px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1px; }" +
                    "</style></head>" +
                    "<body>" +
                    "  <table width='100%' border='0' cellspacing='0' cellpadding='0' style='background-color: #000000; padding: 40px 10px;'>" +
                    "    <tr><td align='center'>" +
                    "      <table width='100%' style='max-width: 500px;' border='0' cellspacing='0' cellpadding='0'>" +
                    "        <tr><td style='padding-bottom: 40px; text-align: left;'>" +
                    "          <span style='color: #ffffff; font-size: 20px; font-weight: 900; letter-spacing: 5px;'>MAGICVS</span>" +
                    "        </td></tr>" +
                    "        <tr><td style='background-color: #121212; border: 1px solid #222222; border-radius: 24px; padding: 50px 30px; text-align: center;'>" +
                    "          <div style='text-align: center; margin-bottom: 25px;'><img src='cid:logo' width='180' alt='MagicVS Logo'></div>" +
                    "          <h2 style='color: #ffffff; font-size: 28px; margin: 0 0 15px 0; font-weight: 800;'>" + title + "</h2>" +
                    "          <p style='color: #a1a1aa; font-size: 15px; line-height: 1.6; margin-bottom: 30px;'>" + message + "</p>";

            if (played > 0) {
                htmlContent += "          <div class='stats-box'>" +
                        "            <table width='100%'><tr>" +
                        "              <td width='50%' align='center'>" +
                        "                <div class='stat-val'>" + played + "</div>" +
                        "                <div class='stat-label'>Partidas</div>" +
                        "              </td>" +
                        "              <td width='50%' align='center'>" +
                        "                <div class='stat-val'>" + won + "</div>" +
                        "                <div class='stat-label'>Victorias</div>" +
                        "              </td>" +
                        "            </tr></table>" +
                        "          </div>";
            }

            htmlContent += "          <a href='http://localhost:4200' style='display: inline-block; background-color: " + accentColor + "; color: #000; padding: 15px 35px; border-radius: 10px; text-decoration: none; font-weight: 900; font-size: 13px; text-transform: uppercase; margin-top: 20px;'>" + buttonText + "</a>" +
                    "        </td></tr>" +
                    "        <tr><td style='padding: 40px 0; text-align: center;'>" +
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
            logger.error("Error enviando reporte diario a {}", user.getEmail(), ex);
        }
    }
}
