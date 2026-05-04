package com.magicvs.backend.service;

import com.magicvs.backend.dto.CreateMatchDTO;
import com.magicvs.backend.dto.MatchHistoryDto;
import com.magicvs.backend.dto.MatchResultDTO;
import com.magicvs.backend.model.Match;
import com.magicvs.backend.model.MatchStatus;
import com.magicvs.backend.model.User;
import com.magicvs.backend.model.UserDailyStats;
import com.magicvs.backend.repository.MatchRepository;
import com.magicvs.backend.repository.UserRepository;
import com.magicvs.backend.repository.UserDailyStatsRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class MatchService {

    private final EloService eloService;
    private final UserRepository userRepository;
    private final MatchRepository matchRepository;
    private final UserDailyStatsRepository dailyStatsRepository;

    public MatchService(EloService eloService,
                        UserRepository userRepository,
                        MatchRepository matchRepository,
                        UserDailyStatsRepository dailyStatsRepository) {
        this.eloService = eloService;
        this.userRepository = userRepository;
        this.matchRepository = matchRepository;
        this.dailyStatsRepository = dailyStatsRepository;
    }

    // --- TU LÓGICA: Procesamiento de partidas y ELO ---
    @Transactional
    public MatchResultDTO processMatch(CreateMatchDTO dto) {
        User p1 = userRepository.findById(dto.getPlayer1Id()).orElseThrow();
        User p2 = userRepository.findById(dto.getPlayer2Id()).orElseThrow();

        int before1 = p1.getElo();
        int before2 = p2.getElo();

        boolean p1Wins = p1.getId().equals(dto.getWinnerId());
        boolean p2Wins = p2.getId().equals(dto.getWinnerId());

        int after1 = eloService.calculateNewElo(p1, p2, p1Wins);
        int after2 = eloService.calculateNewElo(p2, p1, p2Wins);

        p1.setElo(after1);
        p2.setElo(after2);

        if (p1Wins) {
            p1.addWin();
            p2.addLoss();
        } else {
            p2.addWin();
            p1.addLoss();
        }

        userRepository.save(p1);
        userRepository.save(p2);

        Match match = new Match(
                p1, p2, dto.getWinnerId(),
                before1, before2, after1, after2
        );

        matchRepository.save(match);

        MatchResultDTO res = new MatchResultDTO();
        res.setPlayer1Id(p1.getId());
        res.setPlayer2Id(p2.getId());
        res.setWinnerId(dto.getWinnerId());
        res.setEloBeforeP1(before1);
        res.setEloAfterP1(after1);
        res.setEloBeforeP2(before2);
        res.setEloAfterP2(after2);

        return res;
    }

    // --- LÓGICA DE HISTORIAL DE BATALLAS ---
    public List<MatchHistoryDto> getHistoryForUser(Long userId) {
        User user = userRepository.findById(userId).orElseThrow();
        List<Match> matches = matchRepository.findByUserAndStatus(user, MatchStatus.FINISHED);

        return matches.stream()
                .map(m -> mapToDto(m, userId))
                .collect(Collectors.toList());
    }

    private MatchHistoryDto mapToDto(Match match, Long currentUserId) {
        MatchHistoryDto dto = new MatchHistoryDto();
        dto.setId(match.getId());
        
        dto.setPlayer1(new MatchHistoryDto.PlayerDto(
                match.getPlayer1().getUsername(),
                match.getPlayer1().getAvatarUrl()
        ));
        
        if (match.getPlayer2() != null) {
            dto.setPlayer2(new MatchHistoryDto.PlayerDto(
                    match.getPlayer2().getUsername(),
                    match.getPlayer2().getAvatarUrl()
            ));
        }

        if (match.getWinnerId() != null) {
            if (match.getWinnerId().equals(currentUserId)) {
                dto.setWinner("Current_User");
            } else {
                dto.setWinner("Opponent");
            }
        }

        dto.setScore((match.getScoreP1() != null ? match.getScoreP1() : 0) + " - " + 
                     (match.getScoreP2() != null ? match.getScoreP2() : 0));
        
        dto.setEloChange(match.getEloChange());
        dto.setFormat(match.getFormat());
        dto.setTimestamp(match.getFinishedAt() != null ? match.getFinishedAt().toString() : match.getCreatedAt().toString());

        dto.setDeck1(new MatchHistoryDto.DeckSummaryDto(
                match.getDeckArchetype1(),
                match.getDeckColors1() != null ? Arrays.asList(match.getDeckColors1().split(",")) : List.of()
        ));

        dto.setDeck2(new MatchHistoryDto.DeckSummaryDto(
                match.getDeckArchetype2(),
                match.getDeckColors2() != null ? Arrays.asList(match.getDeckColors2().split(",")) : List.of()
        ));

        return dto;
    }

    // --- LÓGICA DE DEVELOP: Estadísticas diarias ---
    @Transactional
    public void recordMatchResult(Long userId, boolean won) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));

        // 1. Actualizar totales globales en el usuario
        user.setGamesPlayed(user.getGamesPlayed() + 1);
        if (won) {
            user.setGamesWon(user.getGamesWon() + 1);
        } else {
            user.setGamesLost(user.getGamesLost() + 1);
        }
        userRepository.save(user);

        // 2. Actualizar estadísticas diarias
        LocalDate today = LocalDate.now();
        UserDailyStats dailyStats = dailyStatsRepository.findByUserAndDate(user, today)
                .orElseGet(() -> UserDailyStats.builder()
                        .user(user)
                        .date(today)
                        .gamesPlayed(0)
                        .gamesWon(0)
                        .gamesLost(0)
                        .build());

        dailyStats.setGamesPlayed(dailyStats.getGamesPlayed() + 1);
        if (won) {
            dailyStats.setGamesWon(dailyStats.getGamesWon() + 1);
        } else {
            dailyStats.setGamesLost(dailyStats.getGamesLost() + 1);
        }
        dailyStatsRepository.save(dailyStats);
    }
}