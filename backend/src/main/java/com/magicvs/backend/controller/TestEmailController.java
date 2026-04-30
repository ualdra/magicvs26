package com.magicvs.backend.controller;

import com.magicvs.backend.service.DailyReportService;
import com.magicvs.backend.service.MatchService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/test/daily-email")
public class TestEmailController {

    private final DailyReportService dailyReportService;
    private final MatchService matchService;

    public TestEmailController(DailyReportService dailyReportService, MatchService matchService) {
        this.dailyReportService = dailyReportService;
        this.matchService = matchService;
    }

    @PostMapping("/trigger")
    public ResponseEntity<String> triggerEmail() {
        dailyReportService.sendDailyReports();
        return ResponseEntity.ok("Proceso de envío de emails diarios iniciado.");
    }

    @PostMapping("/simulate-match")
    public ResponseEntity<String> simulateMatch(@RequestParam Long userId, @RequestParam boolean won) {
        matchService.recordMatchResult(userId, won);
        return ResponseEntity.ok("Partida simulada registrada para el usuario " + userId);
    }
}
