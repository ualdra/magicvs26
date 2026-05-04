package com.magicvs.backend.service;

import com.magicvs.backend.dto.RankingDTO;
import com.magicvs.backend.model.User;
import com.magicvs.backend.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

@Service
public class RankingService {

    private final UserRepository userRepository;

    public RankingService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public List<RankingDTO> getTopPlayers(int limit) {

        List<User> users = userRepository.findTopByElo(PageRequest.of(0, limit));

        AtomicInteger position = new AtomicInteger(1);

        return users.stream()
                .map(u -> new RankingDTO(
                        u.getUsername(),
                        u.getElo(),
                        position.getAndIncrement()
                ))
                .collect(Collectors.toList());
    }
}