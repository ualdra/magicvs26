package com.magicvs.backend.controller;

import com.magicvs.backend.dto.RankingDTO;
import com.magicvs.backend.service.RankingService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/ranking")
public class RankingController {

    private final RankingService rankingService;

    public RankingController(RankingService rankingService) {
        this.rankingService = rankingService;
    }

    @GetMapping
    public List<RankingDTO> getRanking(@RequestParam(defaultValue = "50") int limit) {
        return rankingService.getTopPlayers(limit);
    }
}