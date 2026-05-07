package com.magicvs.backend.dto;

import com.magicvs.backend.model.Achievement;
import com.magicvs.backend.model.AchievementCategory;
import com.magicvs.backend.model.AchievementRank;

public record AchievementDto(
    Long id,
    String key,
    String name,
    String description,
    AchievementCategory category,
    String iconUrl,
    Integer points,
    Integer targetValue,
    AchievementRank rango
) {
    public static AchievementDto fromEntity(Achievement a) {
        return new AchievementDto(
            a.getId(),
            a.getKey(),
            a.getName(),
            a.getDescription(),
            a.getCategory(),
            a.getIconUrl(),
            a.getPoints(),
            a.getTargetValue(),
            a.getRango()
        );
    }
}
