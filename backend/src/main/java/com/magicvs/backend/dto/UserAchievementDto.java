package com.magicvs.backend.dto;

import com.magicvs.backend.model.UserAchievement;

import java.time.LocalDateTime;

public record UserAchievementDto(
    AchievementDto achievement,
    Integer progressValue,
    boolean unlocked,
    LocalDateTime earnedAt
) {
    public static UserAchievementDto fromEntity(UserAchievement ua) {
        return new UserAchievementDto(
            AchievementDto.fromEntity(ua.getAchievement()),
            ua.getProgressValue(),
            ua.isUnlocked(),
            ua.getEarnedAt()
        );
    }
}
