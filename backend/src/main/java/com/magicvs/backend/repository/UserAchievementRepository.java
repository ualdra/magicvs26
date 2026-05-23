package com.magicvs.backend.repository;

import com.magicvs.backend.model.Achievement;
import com.magicvs.backend.model.User;
import com.magicvs.backend.model.UserAchievement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserAchievementRepository extends JpaRepository<UserAchievement, Long> {

    // Busca el progreso de un jugador en un logro concreto
    Optional<UserAchievement> findByUserAndAchievement(User user, Achievement achievement);

    // Todos los logros (desbloqueados y en progreso) de un jugador
    List<UserAchievement> findByUser(User user);

    // Solo los logros ya desbloqueados de un jugador
    List<UserAchievement> findByUserAndEarnedAtIsNotNull(User user);

    long deleteByAchievement(Achievement achievement);

    @Query("SELECT COALESCE(SUM(ua.achievement.points), 0) FROM UserAchievement ua WHERE ua.user.id = :userId AND ua.earnedAt IS NOT NULL")
    Integer sumAchievementPointsByUserId(@Param("userId") Long userId);
}
