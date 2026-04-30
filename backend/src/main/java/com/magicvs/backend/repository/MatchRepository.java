package com.magicvs.backend.repository;

import com.magicvs.backend.model.Match;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MatchRepository extends JpaRepository<Match, Long> {

    // Historial de partidas de un usuario
    List<Match> findByPlayer1IdOrPlayer2Id(Long player1Id, Long player2Id);
}