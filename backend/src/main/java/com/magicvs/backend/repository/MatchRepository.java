package com.magicvs.backend.repository;

import com.magicvs.backend.model.Match;
import com.magicvs.backend.model.MatchStatus;
import com.magicvs.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface MatchRepository extends JpaRepository<Match, Long> {

    @Query("SELECT m FROM Match m WHERE (m.player1 = :user OR m.player2 = :user) AND m.status = :status ORDER BY m.createdAt DESC")
    List<Match> findByUserAndStatus(@Param("user") User user, @Param("status") MatchStatus status);

    List<Match> findByStatus(MatchStatus status);

    @Query("SELECT m FROM Match m WHERE (m.player1 = :user OR m.player2 = :user) AND m.status = com.magicvs.backend.model.MatchStatus.FINISHED AND m.finishedAt >= :start AND m.finishedAt < :end ORDER BY m.finishedAt ASC")
    List<Match> findFinishedByUserInDateRange(@Param("user") User user, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("SELECT m FROM Match m WHERE (m.player1.id IN :friendIds OR m.player2.id IN :friendIds) AND m.status = com.magicvs.backend.model.MatchStatus.LIVE ORDER BY m.createdAt DESC")
    List<Match> findActiveMatchesByFriendIds(@Param("friendIds") List<Long> friendIds);
}
