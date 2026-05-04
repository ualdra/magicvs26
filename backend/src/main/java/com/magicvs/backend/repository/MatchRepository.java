package com.magicvs.backend.repository;

import com.magicvs.backend.model.Match;
import com.magicvs.backend.model.MatchStatus;
import com.magicvs.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MatchRepository extends JpaRepository<Match, Long> {

    @Query("SELECT m FROM Match m WHERE (m.player1 = :user OR m.player2 = :user) AND m.status = :status ORDER BY m.createdAt DESC")
    List<Match> findByUserAndStatus(@Param("user") User user, @Param("status") MatchStatus status);

    List<Match> findByStatus(MatchStatus status);
}
