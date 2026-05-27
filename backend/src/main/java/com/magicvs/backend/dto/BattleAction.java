package com.magicvs.backend.dto;

import lombok.Data;
import java.util.Map;

@Data
public class BattleAction {
    private String type;
    private String playerId;
    private Map<String, Object> payload;
}
