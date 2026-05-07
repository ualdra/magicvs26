package com.magicvs.backend.service;

import com.magicvs.backend.model.Card;
import com.magicvs.backend.repository.CardRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;

@Service
public class ImageDownloadService {

    private static final Logger logger = LoggerFactory.getLogger(ImageDownloadService.class);
    private final CardRepository cardRepository;

    public ImageDownloadService(CardRepository cardRepository) {
        this.cardRepository = cardRepository;
    }

    @Async
    public void downloadMissingImagesAsync() {
        logger.info("Iniciando tarea asíncrona de descarga de imágenes...");
        List<CardRepository.CardImageProjection> cards = cardRepository.findAllImageUris();
        
        Path dirPath = Paths.get("/app/cards");
        try {
            if (!Files.exists(dirPath)) {
                Files.createDirectories(dirPath);
                logger.info("Directorio /app/cards creado con éxito.");
            }
        } catch (Exception e) {
            logger.error("No se pudo crear o acceder al directorio de imágenes: /app/cards", e);
            return;
        }

        int downloaded = 0;
        int skipped = 0;
        int errors = 0;

        for (CardRepository.CardImageProjection card : cards) {
            if (card.getScryfallId() == null) {
                continue;
            }

            String imageUrl = card.getNormalImageUri();
            if (imageUrl == null) {
                imageUrl = card.getFaceNormalImageUri();
            }

            if (imageUrl == null) {
                continue; // No hay imagen disponible
            }

            String filename = card.getScryfallId().toString() + ".jpg";
            Path imagePath = dirPath.resolve(filename);

            if (Files.exists(imagePath)) {
                skipped++;
                continue; // La imagen ya existe, saltar
            }

            try {
                URL url = new URL(imageUrl);
                java.net.HttpURLConnection connection = (java.net.HttpURLConnection) url.openConnection();
                connection.setRequestProperty("User-Agent", "MagicVS/1.0");
                connection.setRequestProperty("Accept", "image/jpeg, image/png, image/*");
                
                try (InputStream in = connection.getInputStream()) {
                    Files.copy(in, imagePath, StandardCopyOption.REPLACE_EXISTING);
                }
                downloaded++;
                
                // Retraso de 100ms para respetar la tasa de Scryfall (10 peticiones por segundo)
                Thread.sleep(100);
            } catch (Exception e) {
                logger.error("Error descargando imagen para ID {}: {}", card.getScryfallId(), e.getMessage());
                errors++;
            }
            
            // Imprimir progreso cada 500 cartas procesadas para no saturar los logs
            if ((downloaded + skipped + errors) % 500 == 0) {
                logger.info("Progreso descarga imágenes: {} procesadas de {} (Nuevas: {}, Omitidas: {}, Errores: {})", 
                        (downloaded + skipped + errors), cards.size(), downloaded, skipped, errors);
            }
        }

        logger.info("Tarea asíncrona de imágenes finalizada. Descargadas hoy: {}, Ya existían: {}, Errores: {}", downloaded, skipped, errors);
    }
}
