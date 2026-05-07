package com.magicvs.backend.service;

import com.magicvs.backend.model.User;

public interface EloService {
    int calculateNewElo(User player, User opponent, boolean win);
}