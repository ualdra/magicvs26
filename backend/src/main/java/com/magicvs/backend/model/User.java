package com.magicvs.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(nullable = false, unique = true, length = 100)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "display_name", length = 100)
    private String displayName;

    @Column(length = 255)
    private String avatarUrl;

    @Column(length = 255)
    private String country;

    @Column(length = 500)
    private String bio;

    @Column(name = "elo_rating", nullable = false)
    private int eloRating = 1200;

    @Column(name = "games_played", nullable = false)
    private int gamesPlayed = 0;

    @Column(name = "games_won", nullable = false)
    private int gamesWon = 0;

    @Column(name = "games_lost", nullable = false)
    private int gamesLost = 0;

    @Column(name = "friend_tag", unique = true, length = 16)
    private String friendTag;

    @Column(name = "friends_count", nullable = false)
    private int friendsCount = 0;

    @Column(name = "is_active", nullable = false)
    private Boolean active = true;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "google_id", unique = true, length = 255)
    private String googleId;

    public User() {}

    // ===== LIFECYCLE =====

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    // ===== LÓGICA DE NEGOCIO=====

    public void addWin() {
        this.gamesPlayed++;
        this.gamesWon++;
    }

    public void addLoss() {
        this.gamesPlayed++;
        this.gamesLost++;
    }

    public double getWinRate() {
        if (gamesPlayed == 0) return 0.0;
        return (double) gamesWon / gamesPlayed;
    }

    // ===== GETTERS & SETTERS =====

    public Long getId() { return id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }

    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }

    public String getCountry() { return country; }
    public void setCountry(String country) { this.country = country; }

    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }

    public int getElo() { return eloRating; }
    public void setElo(int eloRating) { this.eloRating = eloRating; }

    public int getGamesPlayed() { return gamesPlayed; }

    public int getGamesWon() { return gamesWon; }

    public int getGamesLost() { return gamesLost; }

    public String getFriendTag() { return friendTag; }
    public void setFriendTag(String friendTag) { this.friendTag = friendTag; }

    public int getFriendsCount() { return friendsCount; }
    public void setFriendsCount(int friendsCount) { this.friendsCount = friendsCount; }

    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }

    public LocalDateTime getCreatedAt() { return createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }

    public String getGoogleId() { return googleId; }
    public void setGoogleId(String googleId) { this.googleId = googleId; }
}