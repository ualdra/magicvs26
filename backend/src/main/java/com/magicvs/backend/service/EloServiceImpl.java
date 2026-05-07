package com.magicvs.backend.service;

import com.magicvs.backend.model.User;
import org.springframework.stereotype.Service;

@Service
public class EloServiceImpl implements EloService {

    private double expectedScore(int playerElo, int opponentElo) {
        return 1.0 / (1.0 + Math.pow(10, (opponentElo - playerElo) / 400.0));
    }

    private int getK(User player) {
        if (player.getGamesPlayed() < 30) return 40;
        if (player.getElo() > 2000) return 16;
        return 24;
    }

    @Override
    public int calculateNewElo(User player, User opponent, boolean win) {

        double expected = expectedScore(player.getElo(), opponent.getElo());
        int k = getK(player);
        int score = win ? 1 : 0;

        int change = (int) Math.round(k * (score - expected));
        change = Math.max(-50, Math.min(50, change));

        return player.getElo() + change;
    }
}