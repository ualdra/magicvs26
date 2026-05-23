package com.magicvs.backend.dto;

import com.magicvs.backend.model.User;

import java.time.LocalDateTime;

public class UserDirectoryResponseDto {
    private Long id;
    private String username;
    private String displayName;
    private Integer elo;
    private Integer puntos;
    private String avatarUrl;
    private String friendTag;
    private boolean isOnline;
    private LocalDateTime lastSeenAt;
    private String friendshipStatus;
    private Integer achievementPoints;

    public UserDirectoryResponseDto() {}

    public UserDirectoryResponseDto(Long id, String username, String displayName, Integer elo, Integer puntos, String avatarUrl, String friendTag, boolean isOnline, LocalDateTime lastSeenAt, String friendshipStatus) {
        this.id = id;
        this.username = username;
        this.displayName = displayName;
        this.elo = elo;
        this.puntos = puntos;
        this.avatarUrl = avatarUrl;
        this.friendTag = friendTag;
        this.isOnline = isOnline;
        this.lastSeenAt = lastSeenAt;
        this.friendshipStatus = friendshipStatus;
    }

    public static UserDirectoryResponseDto fromEntity(User user) {
        return new UserDirectoryResponseDto(
            user.getId(),
            user.getUsername(),
            user.getDisplayName(),
            user.getElo(),
            user.getPuntos(),
            user.getAvatarUrl(),
            user.getFriendTag(),
            Boolean.TRUE.equals(user.getIsOnline()),
            user.getLastSeenAt(),
            "NONE"
        );
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }

    public Integer getElo() { return elo; }
    public void setElo(Integer elo) { this.elo = elo; }

    public Integer getPuntos() { return puntos; }
    public void setPuntos(Integer puntos) { this.puntos = puntos; }

    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }

    public String getFriendTag() { return friendTag; }
    public void setFriendTag(String friendTag) { this.friendTag = friendTag; }

    public boolean getIsOnline() { return isOnline; }
    public void setIsOnline(boolean isOnline) { this.isOnline = isOnline; }

    public LocalDateTime getLastSeenAt() { return lastSeenAt; }
    public void setLastSeenAt(LocalDateTime lastSeenAt) { this.lastSeenAt = lastSeenAt; }

    public String getFriendshipStatus() { return friendshipStatus; }
    public void setFriendshipStatus(String friendshipStatus) { this.friendshipStatus = friendshipStatus; }

    public Integer getAchievementPoints() { return achievementPoints; }
    public void setAchievementPoints(Integer achievementPoints) { this.achievementPoints = achievementPoints; }
}
