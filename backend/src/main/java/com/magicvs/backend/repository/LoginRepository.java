package com.magicvs.backend.repository;

import com.magicvs.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface LoginRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    Optional<User> findByEmail(String email);

    @Modifying
    @Query("UPDATE User u SET u.isOnline = false")
    void resetAllOnlineStatus();
}
