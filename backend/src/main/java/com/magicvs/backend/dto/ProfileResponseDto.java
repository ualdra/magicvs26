package com.magicvs.backend.dto;

public class ProfileResponseDto {

	private Long id;
	private String username;
	private String displayName;
	private String avatarUrl;
	private String country;
	private String bio;
	private Integer eloRating;
	private Integer gamesPlayed;
	private Integer gamesWon;
	private Integer gamesLost;
	private String friendTag;
	private Integer friendsCount;
	private Long decksCount;
	private String email;
	private java.time.LocalDateTime createdAt;
	private Boolean isOnline;
	private java.time.LocalDateTime lastSeenAt;

	public ProfileResponseDto() {
	}

	public ProfileResponseDto(Long id, String username, String displayName, String avatarUrl, String country, String bio,
							  Integer eloRating, Integer gamesPlayed, Integer gamesWon, Integer gamesLost,
							  String friendTag, Integer friendsCount, Long decksCount, String email, java.time.LocalDateTime createdAt,
							  Boolean isOnline, java.time.LocalDateTime lastSeenAt) {
		this.id = id;
		this.username = username;
		this.displayName = displayName;
		this.avatarUrl = avatarUrl;
		this.country = country;
		this.bio = bio;
		this.eloRating = eloRating;
		this.gamesPlayed = gamesPlayed;
		this.gamesWon = gamesWon;
		this.gamesLost = gamesLost;
		this.friendTag = friendTag;
		this.friendsCount = friendsCount;
		this.decksCount = decksCount;
		this.email = email;
		this.createdAt = createdAt;
		this.isOnline = isOnline;
		this.lastSeenAt = lastSeenAt;
	}

	public String getEmail() {
		return email;
	}

	public void setEmail(String email) {
		this.email = email;
	}

	public java.time.LocalDateTime getCreatedAt() {
		return createdAt;
	}

	public void setCreatedAt(java.time.LocalDateTime createdAt) {
		this.createdAt = createdAt;
	}

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	public String getUsername() {
		return username;
	}

	public void setUsername(String username) {
		this.username = username;
	}

	public String getDisplayName() {
		return displayName;
	}

	public void setDisplayName(String displayName) {
		this.displayName = displayName;
	}

	public String getAvatarUrl() {
		return avatarUrl;
	}

	public void setAvatarUrl(String avatarUrl) {
		this.avatarUrl = avatarUrl;
	}

	public String getCountry() {
		return country;
	}

	public void setCountry(String country) {
		this.country = country;
	}

	public String getBio() {
		return bio;
	}

	public void setBio(String bio) {
		this.bio = bio;
	}

	public Integer getEloRating() {
		return eloRating;
	}

	public void setEloRating(Integer eloRating) {
		this.eloRating = eloRating;
	}

	public Integer getGamesPlayed() {
		return gamesPlayed;
	}

	public void setGamesPlayed(Integer gamesPlayed) {
		this.gamesPlayed = gamesPlayed;
	}

	public Integer getGamesWon() {
		return gamesWon;
	}

	public void setGamesWon(Integer gamesWon) {
		this.gamesWon = gamesWon;
	}

	public Integer getGamesLost() {
		return gamesLost;
	}

	public void setGamesLost(Integer gamesLost) {
		this.gamesLost = gamesLost;
	}

	public String getFriendTag() {
		return friendTag;
	}

	public void setFriendTag(String friendTag) {
		this.friendTag = friendTag;
	}

	public Integer getFriendsCount() {
		return friendsCount;
	}

	public void setFriendsCount(Integer friendsCount) {
		this.friendsCount = friendsCount;
	}

	public Long getDecksCount() {
		return decksCount;
	}

	public void setDecksCount(Long decksCount) {
		this.decksCount = decksCount;
	}

	public Boolean getIsOnline() {
		return isOnline;
	}

	public void setIsOnline(Boolean isOnline) {
		this.isOnline = isOnline;
	}

	public java.time.LocalDateTime getLastSeenAt() {
		return lastSeenAt;
	}

	public void setLastSeenAt(java.time.LocalDateTime lastSeenAt) {
		this.lastSeenAt = lastSeenAt;
	}
}
