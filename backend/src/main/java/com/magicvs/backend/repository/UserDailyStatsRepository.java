package com.magicvs.backend.repository;

import com.magicvs.backend.model.User;
import com.magicvs.backend.model.UserDailyStats;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserDailyStatsRepository extends JpaRepository<UserDailyStats, Long> {
    Optional<UserDailyStats> findByUserAndDate(User user, LocalDate date);
    List<UserDailyStats> findByDate(LocalDate date);
}
