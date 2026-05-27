package com.magicvs.backend.service;

import com.magicvs.backend.model.*;
import com.magicvs.backend.repository.AchievementRepository;
import com.magicvs.backend.repository.UserAchievementRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@Transactional(readOnly = true)
public class AchievementService {

    private final AchievementRepository achievementRepository;
    private final UserAchievementRepository userAchievementRepository;
    private final NotificationService notificationService;

    public AchievementService(AchievementRepository achievementRepository,
                               UserAchievementRepository userAchievementRepository,
                               NotificationService notificationService) {
        this.achievementRepository = achievementRepository;
        this.userAchievementRepository = userAchievementRepository;
        this.notificationService = notificationService;
    }

    /**
     * Incrementa el progreso de un jugador en un logro concreto.
     * Si llega al objetivo, lo desbloquea y manda una notificación.
     *
     * @param user           El jugador al que se le incrementa el progreso
     * @param achievementKey El identificador del logro (ej: "FIRST_WIN", "WIN_50")
     */
    @Transactional
    public void increment(User user, String achievementKey) {
        Achievement achievement = achievementRepository.findByAchievementKey(achievementKey)
                .orElseThrow(() -> new IllegalArgumentException("Logro no encontrado: " + achievementKey));

        UserAchievement userAchievement = userAchievementRepository
                .findByUserAndAchievement(user, achievement)
                .orElseGet(() -> UserAchievement.builder()
                        .user(user)
                        .achievement(achievement)
                        .progressValue(0)
                        .build());

        // Si ya estaba desbloqueado, no hacer nada
        if (userAchievement.isUnlocked()) {
            return;
        }

        userAchievement.setProgressValue(userAchievement.getProgressValue() + 1);

        if (userAchievement.getProgressValue() >= achievement.getTargetValue()) {
            userAchievement.setEarnedAt(LocalDateTime.now());
            userAchievementRepository.save(userAchievement);
            sendUnlockNotification(user, achievement);
        } else {
            userAchievementRepository.save(userAchievement);
        }
    }

    public List<UserAchievement> getUserAchievements(User user) {
        return userAchievementRepository.findByUser(user);
    }

    public List<UserAchievement> getUnlockedAchievements(User user) {
        return userAchievementRepository.findByUserAndEarnedAtIsNotNull(user);
    }

    public List<Achievement> getAllAchievements() {
        return achievementRepository.findAll();
    }

    private void sendUnlockNotification(User user, Achievement achievement) {
        notificationService.createNotification(
                user.getId(),
                NotificationType.ACHIEVEMENT_UNLOCKED,
                Map.of(
                        "userId", user.getId().toString(),
                        "achievementKey", achievement.getAchievementKey(),
                        "achievementName", achievement.getName(),
                        "achievementDescription", achievement.getDescription(),
                        "points", achievement.getPoints()
                )
        );
    }
}
