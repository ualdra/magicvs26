package com.magicvs.backend.dto;

public class UpdateProfileDto {
    private String displayName;
    private String avatarUrl;
    private String country;
    private String bio;

    public UpdateProfileDto() {
    }

    public UpdateProfileDto(String displayName, String avatarUrl, String country, String bio) {
        this.displayName = displayName;
        this.avatarUrl = avatarUrl;
        this.country = country;
        this.bio = bio;
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
}
