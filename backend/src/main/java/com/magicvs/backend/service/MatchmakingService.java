package com.magicvs.backend.service;

import com.magicvs.backend.model.*;
import com.magicvs.backend.repository.MatchRepository;
import com.magicvs.backend.repository.RegistroRepository; 
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

@Slf4j
@Service
@RequiredArgsConstructor
public class MatchmakingService {

    private final MatchRepository matchRepository;
    private final RegistroRepository registroRepository;
    private final NotificationService notificationService;
    private final BattleService battleService;
    private final CopyOnWriteArrayList<QueuedPlayer> queue = new CopyOnWriteArrayList<>();

    public synchronized void joinQueue(Long userId, int elo, Long deckId) {
        queue.removeIf(p -> p.getUserId().equals(userId));
        queue.add(new QueuedPlayer(userId, elo, deckId));
        log.info("Matchmaking: Usuario {} (ELO: {}) en cola con mazo {}", userId, elo, deckId);
    }

    public synchronized void leaveQueue(Long userId) {
        queue.removeIf(p -> p.getUserId().equals(userId));
    }

    @Scheduled(fixedDelay = 2000)
    public synchronized void runMatchmaking() {
        if (queue.size() < 2) return;

        for (int i = 0; i < queue.size(); i++) {
            for (int j = i + 1; j < queue.size(); j++) {
                QueuedPlayer p1 = queue.get(i);
                QueuedPlayer p2 = queue.get(j);

                if (isMatchPossible(p1, p2)) {
                    executeMatch(p1, p2);
                    return; 
                }
            }
        }
    }

    private boolean isMatchPossible(QueuedPlayer p1, QueuedPlayer p2) {
        int eloDiff = Math.abs(p1.getElo() - p2.getElo());
        // Lógica de rangos competitivos
        return eloDiff <= p1.getSearchRange() || eloDiff <= p2.getSearchRange();
    }

    @Transactional
    protected void executeMatch(QueuedPlayer p1, QueuedPlayer p2) {
        // Limpiar la cola primero para evitar duplicados
        queue.remove(p1);
        queue.remove(p2);

        // Usar el repositorio para buscar los usuarios
        User u1 = registroRepository.findById(p1.getUserId()).orElseThrow();
        User u2 = registroRepository.findById(p2.getUserId()).orElseThrow();

        Match match = new Match();
        match.setPlayer1(u1);
        match.setPlayer2(u2);
        match.setStatus(MatchStatus.LIVE);
        match.setFormat("Standard");
        
        match = matchRepository.save(match);

        // 3. Inicializar batalla y enviar notificaciones
        battleService.initializeMatch(match.getId(), p1.getDeckId(), p2.getDeckId());
        
        notifyMatchFound(u1, match.getId());
        notifyMatchFound(u2, match.getId());

        log.info("PARTIDA CREADA: {} vs {} - ID: {}", u1.getUsername(), u2.getUsername(), match.getId());
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