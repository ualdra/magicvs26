package com.magicvs.backend.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;

@RestController
@RequestMapping("/api")
public class HealthController {

    private final DataSource dataSource;

    public HealthController(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @GetMapping("/health")
    public String health() {
        return "MagicVS backend is running";
    }

    @GetMapping("/health/db")
    public String checkDatabaseConnection() {
        try (Connection connection = dataSource.getConnection()) {
            return "Database connection successful: " + connection.getMetaData().getURL();
        } catch (Exception e) {
            return "Database connection failed: " + e.getMessage();
        }
    }
}