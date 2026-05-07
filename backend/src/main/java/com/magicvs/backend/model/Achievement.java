package com.magicvs.backend.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "achievements")
public class Achievement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "achievement_key", nullable = false, unique = true, length = 60)
    private String key;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 300)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AchievementCategory category;

    @Column(name = "icon_url", length = 255)
    private String iconUrl;

    @Column(nullable = false)
    private Integer points;

    @Enumerated(EnumType.STRING)
    @Column(length = 10)
    private AchievementRank rango;

    // Cuántas veces hay que hacer algo para desbloquear el logro (1 = una sola vez)
    @Column(name = "target_value", nullable = false)
    private Integer targetValue;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        if (this.targetValue == null) {
            this.targetValue = 1;
        }
        if (this.points == null) {
            this.points = 10;
        }
        if (this.rango == null) {
            this.rango = AchievementRank.BRONCE;
        }
    }

    public Long getId() {
        return id;
    }

    public String getKey() {
        return key;
    }

    public void setKey(String key) {
        this.key = key;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public AchievementCategory getCategory() {
        return category;
    }

    public void setCategory(AchievementCategory category) {
        this.category = category;
    }

    public String getIconUrl() {
        return iconUrl;
    }

    public void setIconUrl(String iconUrl) {
        this.iconUrl = iconUrl;
    }

    public Integer getPoints() {
        return points;
    }

    public void setPoints(Integer points) {
        this.points = points;
    }

    public AchievementRank getRango() {
        return rango;
    }

    public void setRango(AchievementRank rango) {
        this.rango = rango;
    }

    public Integer getTargetValue() {
        return targetValue;
    }

    public void setTargetValue(Integer targetValue) {
        this.targetValue = targetValue;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
