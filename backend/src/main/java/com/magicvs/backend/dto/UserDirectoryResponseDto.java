package com.magicvs.backend.dto;

import com.magicvs.backend.model.User;

import java.time.LocalDateTime;

public class UserDirectoryResponseDto {
    private Long id;
    private String username;
    private String displayName;
    private Integer elo;
    private String avatarUrl;
    private boolean isOnline;
    private LocalDateTime lastSeenAt;
    private String friendshipStatus;

    public UserDirectoryResponseDto() {}

    public UserDirectoryResponseDto(Long id, String username, String displayName, Integer elo, String avatarUrl, boolean isOnline, LocalDateTime lastSeenAt, String friendshipStatus) {
        this.id = id;
        this.username = username;
        this.displayName = displayName;
        this.elo = elo;
        this.avatarUrl = avatarUrl;
        this.isOnline = isOnline;
        this.lastSeenAt = lastSeenAt;
        this.friendshipStatus = friendshipStatus;
    }

    public static UserDirectoryResponseDto fromEntity(User user) {
        return new UserDirectoryResponseDto(
            user.getId(),
            user.getUsername(),
            user.getDisplayName(),
            user.getEloRating(),
            user.getAvatarUrl(),
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

    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }

    public boolean getIsOnline() { return isOnline; }
    public void setIsOnline(boolean isOnline) { this.isOnline = isOnline; }

    public LocalDateTime getLastSeenAt() { return lastSeenAt; }
    public void setLastSeenAt(LocalDateTime lastSeenAt) { this.lastSeenAt = lastSeenAt; }

    public String getFriendshipStatus() { return friendshipStatus; }
    public void setFriendshipStatus(String friendshipStatus) { this.friendshipStatus = friendshipStatus; }
}
