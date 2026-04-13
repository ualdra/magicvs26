package com.magicvs.backend.controller;

import com.magicvs.backend.model.Card;
import com.magicvs.backend.service.ScryfallService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/cards/import")
public class CardImportController {

    @Autowired
    private ScryfallService scryfallService;

    /**
     * Importa todas las cartas legales en Standard.
     */
    @PostMapping("/standard")
    public ResponseEntity<Map<String, Object>> importStandard() {
        int count = scryfallService.importStandardCards();
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Importación de Standard completada");
        response.put("count", count);
        return ResponseEntity.ok(response);
    }

    /**
     * Importa una carta por nombre.
     */
    @PostMapping("/name")
    public ResponseEntity<Map<String, Object>> importByName(
            @RequestParam String name,
            @RequestParam(defaultValue = "true") boolean onlyStandard) {
        
        Card card = scryfallService.importCardByName(name, onlyStandard);
        Map<String, Object> response = new HashMap<>();
        if (card != null) {
            response.put("message", "Carta importada con éxito");
            response.put("cardName", card.getName());
            return ResponseEntity.ok(response);
        } else {
            response.put("message", "No se pudo encontrar o importar la carta");
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * Importa todas las cartas de un set.
     */
    @PostMapping("/set")
    public ResponseEntity<Map<String, Object>> importBySet(
            @RequestParam String code,
            @RequestParam(defaultValue = "true") boolean onlyStandard) {
        
        int count = scryfallService.importCardsBySet(code, onlyStandard);
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Importación del set " + code + " completada");
        response.put("count", count);
        return ResponseEntity.ok(response);
    }
}
