package com.magicvs.backend.repository;

import com.magicvs.backend.model.User;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);
    
    @Query("SELECT u FROM User u ORDER BY u.elo DESC")
    List<User> findTopByElo(Pageable pageable);
}