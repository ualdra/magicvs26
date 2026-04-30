package com.magicvs.backend.controller;

import com.magicvs.backend.dto.CreateMatchDTO;
import com.magicvs.backend.dto.MatchResultDTO;
import com.magicvs.backend.service.MatchService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/matches")
public class MatchController {

    private final MatchService matchService;

    public MatchController(MatchService matchService) {
        this.matchService = matchService;
    }

    @PostMapping
    public MatchResultDTO playMatch(@RequestBody CreateMatchDTO dto) {
        return matchService.processMatch(dto);
    }
}