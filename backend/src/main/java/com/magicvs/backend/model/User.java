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

    // --- TU LÓGICA DE ELO Y ESTADÍSTICAS ---
    @Column(name = "elo_rating", nullable = false)
    private Integer eloRating = 1200;

    @Column(name = "games_played", nullable = false)
    private Integer gamesPlayed = 0;

    @Column(name = "games_won", nullable = false)
    private Integer gamesWon = 0;

    @Column(name = "games_lost", nullable = false)
    private Integer gamesLost = 0;

    // --- SOCIAL Y ESTADO ---
    @Column(name = "friend_tag", unique = true, length = 16)
    private String friendTag;

    @Column(name = "friends_count", nullable = false)
    private Integer friendsCount = 0;

    @Column(name = "is_active")
    private Boolean active = true;

    @Column(name = "is_online")
    private Boolean isOnline = false;

    @Column(name = "last_seen_at")
    private LocalDateTime lastSeenAt;

    // --- SEGURIDAD Y REGISTRO ---
    @Column(name = "google_id", unique = true, length = 255)
    private String googleId;

    @Column(name = "manual_registration")
    private Boolean manualRegistration = true;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public User() {}

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
        
        // Inicializaciones de seguridad para evitar Nulos en la BD
        if (this.eloRating == null) this.eloRating = 1200;
        if (this.gamesPlayed == null) this.gamesPlayed = 0;
        if (this.gamesWon == null) this.gamesWon = 0;
        if (this.gamesLost == null) this.gamesLost = 0;
        if (this.friendsCount == null) this.friendsCount = 0;
        if (this.active == null) this.active = true;
        if (this.isOnline == null) this.isOnline = false;
        if (this.manualRegistration == null) this.manualRegistration = true;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    // --- LÓGICA DE NEGOCIO (Tu motor) ---

    public void addWin() {
        this.gamesPlayed++;
        this.gamesWon++;
    }

    public void addLoss() {
        this.gamesPlayed++;
        this.gamesLost++;
    }

    public double getWinRate() {
        if (gamesPlayed == null || gamesPlayed == 0) return 0.0;
        return (double) gamesWon / gamesPlayed;
    }

    // --- TODOS LOS GETTERS Y SETTERS ---

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

    public Integer getGamesPlayed() { return gamesPlayed; }
    public void setGamesPlayed(Integer gamesPlayed) { this.gamesPlayed = gamesPlayed; }

    public Integer getGamesWon() { return gamesWon; }
    public void setGamesWon(Integer gamesWon) { this.gamesWon = gamesWon; }

    public Integer getGamesLost() { return gamesLost; }
    public void setGamesLost(Integer gamesLost) { this.gamesLost = gamesLost; }

    public String getFriendTag() { return friendTag; }
    public void setFriendTag(String friendTag) { this.friendTag = friendTag; }

    public Integer getFriendsCount() { return friendsCount; }
    public void setFriendsCount(Integer friendsCount) { this.friendsCount = friendsCount; }

    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }

    public Boolean getIsOnline() { return isOnline; }
    public void setIsOnline(Boolean isOnline) { this.isOnline = isOnline; }

    public LocalDateTime getLastSeenAt() { return lastSeenAt; }
    public void setLastSeenAt(LocalDateTime lastSeenAt) { this.lastSeenAt = lastSeenAt; }

    public String getGoogleId() { return googleId; }
    public void setGoogleId(String googleId) { this.googleId = googleId; }

    public Boolean getManualRegistration() { return manualRegistration; }
    public void setManualRegistration(Boolean manualRegistration) { this.manualRegistration = manualRegistration; }

    public LocalDateTime getCreatedAt() { return createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}