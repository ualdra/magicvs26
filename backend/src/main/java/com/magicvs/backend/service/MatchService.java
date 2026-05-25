package com.magicvs.backend.service;

import com.magicvs.backend.dto.MatchHistoryDto;
import com.magicvs.backend.model.Match;
import com.magicvs.backend.model.MatchStatus;
import com.magicvs.backend.model.User;
import com.magicvs.backend.model.UserDailyStats;
import com.magicvs.backend.repository.MatchRepository;
import com.magicvs.backend.repository.RegistroRepository;
import com.magicvs.backend.repository.UserDailyStatsRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class MatchService {

    private final MatchRepository matchRepository;
    private final RegistroRepository userRepository;
    private final UserDailyStatsRepository dailyStatsRepository;
    private final AchievementService achievementService;
    private final com.magicvs.backend.repository.FriendshipRepository friendshipRepository;

    public MatchService(MatchRepository matchRepository, RegistroRepository userRepository,
            UserDailyStatsRepository dailyStatsRepository, AchievementService achievementService,
            com.magicvs.backend.repository.FriendshipRepository friendshipRepository) {
        this.matchRepository = matchRepository;
        this.userRepository = userRepository;
        this.dailyStatsRepository = dailyStatsRepository;
        this.achievementService = achievementService;
        this.friendshipRepository = friendshipRepository;
    }

    public List<MatchHistoryDto> getHistoryForUser(Long userId) {
        User user = userRepository.findById(userId).orElseThrow();
        List<Match> matches = matchRepository.findByUserAndStatus(user, MatchStatus.FINISHED);

        return matches.stream()
                .map(m -> mapToDto(m, userId))
                .collect(Collectors.toList());
    }

    public List<MatchHistoryDto> getActiveMatchesForFriends(Long userId) {
        User user = userRepository.findById(userId).orElseThrow();
        List<com.magicvs.backend.model.Friendship> friends = friendshipRepository.findAcceptedFriendsForUser(user);
        
        List<Long> friendIds = friends.stream()
            .map(f -> f.getUser().getId().equals(userId) ? f.getFriend().getId() : f.getUser().getId())
            .collect(Collectors.toList());
            
        if (friendIds.isEmpty()) {
            return List.of();
        }
        
        List<Match> matches = matchRepository.findActiveMatchesByFriendIds(friendIds);
        return matches.stream()
                .map(m -> mapToDto(m, userId))
                .collect(Collectors.toList());
    }


    private MatchHistoryDto mapToDto(Match match, Long currentUserId) {
        MatchHistoryDto dto = new MatchHistoryDto();
        dto.setId(match.getId());

        dto.setPlayer1(new MatchHistoryDto.PlayerDto(
                match.getPlayer1().getUsername(),
                match.getPlayer1().getAvatarUrl()));

        if (match.getPlayer2() != null) {
            dto.setPlayer2(new MatchHistoryDto.PlayerDto(
                    match.getPlayer2().getUsername(),
                    match.getPlayer2().getAvatarUrl()));
        }

        // Determine winner display
        if (match.getWinnerId() != null) {
            if (match.getWinnerId().equals(currentUserId)) {
                dto.setWinner("Current_User");
            } else {
                dto.setWinner("Opponent");
            }
        }

        dto.setScore(match.getScoreP1() + " - " + match.getScoreP2());
        dto.setEloChange(match.getEloChange());
        dto.setFormat(match.getFormat());
        dto.setTimestamp(
                match.getFinishedAt() != null ? match.getFinishedAt().toString() : match.getCreatedAt().toString());

        dto.setDeck1(new MatchHistoryDto.DeckSummaryDto(
                match.getDeckArchetype1(),
                match.getDeckColors1() != null ? Arrays.asList(match.getDeckColors1().split(",")) : List.of()));

        dto.setDeck2(new MatchHistoryDto.DeckSummaryDto(
                match.getDeckArchetype2(),
                match.getDeckColors2() != null ? Arrays.asList(match.getDeckColors2().split(",")) : List.of()));

        return dto;
    }

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

        // 3. Comprobar logros de partidas jugadas y victorias
        achievementService.increment(user, "FIRST_MATCH");
        achievementService.increment(user, "PLAY_10");
        achievementService.increment(user, "PLAY_50");
        achievementService.increment(user, "PLAY_100");

        if (won) {
            achievementService.increment(user, "FIRST_WIN");
            achievementService.increment(user, "WIN_10");
            achievementService.increment(user, "WIN_50");
            achievementService.increment(user, "WIN_100");
        }

        checkEloAchievements(user);
    }

    @Transactional
    public void checkEloAchievements(User user) {
        int elo = user.getEloRating();
        if (elo >= 1400)
            achievementService.increment(user, "ELO_1400");
        if (elo >= 1600)
            achievementService.increment(user, "ELO_1600");
        if (elo >= 2000)
            achievementService.increment(user, "ELO_2000");
        if (elo >= 2400)
            achievementService.increment(user, "ELO_2400");
    }
}
