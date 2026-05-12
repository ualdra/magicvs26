package com.magicvs.backend.dto;

public class BlockedUserDTO {
    private Long id;
    private String username;

    public BlockedUserDTO(Long id, String username) {
        this.id = id;
        this.username = username;
    }

    public Long getId() { return id; }
    public String getUsername() { return username; }
}