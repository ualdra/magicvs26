package com.magicvs.backend.service;

import com.magicvs.backend.model.Match;
import com.magicvs.backend.model.MatchStatus;
import com.magicvs.backend.model.NotificationType;
import com.magicvs.backend.model.User;
import com.magicvs.backend.repository.MatchRepository;
import com.magicvs.backend.repository.RegistroRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;

@Slf4j
@Service
@RequiredArgsConstructor
public class MatchmakingService {

    private final MatchRepository matchRepository;
    private final RegistroRepository userRepository;
    private final NotificationService notificationService;
    private final BattleService battleService;

    // Queue of user IDs waiting for a match
    private final ConcurrentLinkedQueue<Long> queue = new ConcurrentLinkedQueue<>();
    // Map to store deck IDs for each user in the queue
    private final ConcurrentHashMap<Long, Long> userDecks = new ConcurrentHashMap<>();

    public synchronized void joinQueue(Long userId, Long deckId) {
        if (queue.contains(userId)) {
            log.debug("User {} already in queue, ignoring join request.", userId);
            return;
        }

        if (!queue.isEmpty()) {
            Long opponentId = queue.poll();
            Long opponentDeckId = userDecks.remove(opponentId);
            log.info("Matchmaking: Opponent found! Pairing User {} with User {}", userId, opponentId);
            createMatch(userId, deckId, opponentId, opponentDeckId);
        } else {
            log.info("Matchmaking: User {} added to queue. Waiting for opponent...", userId);
            queue.add(userId);
            userDecks.put(userId, deckId);
        }
    }

    public void leaveQueue(Long userId) {
        queue.remove(userId);
        userDecks.remove(userId);
    }

    private void createMatch(Long u1Id, Long d1Id, Long u2Id, Long d2Id) {
        User u1 = userRepository.findById(u1Id).orElseThrow();
        User u2 = userRepository.findById(u2Id).orElseThrow();

        Match match = new Match();
        match.setPlayer1(u1);
        match.setPlayer2(u2);
        match.setStatus(MatchStatus.LIVE);
        match.setFormat("Standard");
        
        match = matchRepository.save(match);
        log.info("Match created with ID: {}. Players: {} & {}", match.getId(), u1.getUsername(), u2.getUsername());

        // Initialize board state
        battleService.initializeMatch(match.getId(), d1Id, d2Id);

        notifyMatchFound(u1, match.getId());
        notifyMatchFound(u2, match.getId());
    }

    private void notifyMatchFound(User user, Long matchId) {
        Map<String, Object> data = new HashMap<>();
        data.put("matchId", matchId);
        data.put("title", "¡Partida encontrada!");
        data.put("message", "Has sido emparejado. Entrando al campo de batalla...");
        data.put("link", "/battle/" + matchId);

        notificationService.createNotification(user.getId(), NotificationType.MATCH_FOUND, data);
    }
}
