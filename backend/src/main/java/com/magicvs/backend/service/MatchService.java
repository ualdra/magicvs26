package com.magicvs.backend.service;

import com.magicvs.backend.dto.CreateMatchDTO;
import com.magicvs.backend.dto.MatchResultDTO;
import com.magicvs.backend.model.Match;
import com.magicvs.backend.model.User;
import com.magicvs.backend.repository.MatchRepository;
import com.magicvs.backend.repository.UserRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

@Service
public class MatchService {

    private final EloService eloService;
    private final UserRepository userRepository;
    private final MatchRepository matchRepository;

    public MatchService(EloService eloService,
                        UserRepository userRepository,
                        MatchRepository matchRepository) {
        this.eloService = eloService;
        this.userRepository = userRepository;
        this.matchRepository = matchRepository;
    }

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

        // 🔥 Actualizar ELO
        p1.setElo(after1);
        p2.setElo(after2);

        // 🔥 Actualizar estadísticas correctamente
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
                p1.getId(), p2.getId(), dto.getWinnerId(),
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
}