package com.magicvs.backend.config;

import com.magicvs.backend.model.Achievement;
import com.magicvs.backend.model.AchievementCategory;
import com.magicvs.backend.model.AchievementRank;
import com.magicvs.backend.repository.AchievementRepository;
import com.magicvs.backend.repository.UserAchievementRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Component
@Order(2)
public class AchievementInitializer implements CommandLineRunner {

    private static final Logger logger = LoggerFactory.getLogger(AchievementInitializer.class);

    private final AchievementRepository achievementRepository;
    private final UserAchievementRepository userAchievementRepository;

    public AchievementInitializer(AchievementRepository achievementRepository,
                                  UserAchievementRepository userAchievementRepository) {
        this.achievementRepository = achievementRepository;
        this.userAchievementRepository = userAchievementRepository;
    }

    @Override
    @Transactional
    public void run(String... args) {
        logger.info("Sincronizando catálogo de logros...");
        List<Achievement> templates = buildAchievements();
        Set<String> templateKeys = templates.stream()
            .map(Achievement::getAchievementKey)
            .collect(Collectors.toSet());

        for (Achievement template : templates) {
            achievementRepository.findByAchievementKey(template.getAchievementKey()).ifPresentOrElse(
                existing -> {
                    existing.setName(template.getName());
                    existing.setDescription(template.getDescription());
                    existing.setCategory(template.getCategory());
                    existing.setIconUrl(template.getIconUrl());
                    existing.setTargetValue(template.getTargetValue());
                    existing.setPoints(template.getPoints());
                    existing.setRango(template.getRango());
                    achievementRepository.save(existing);
                },
                () -> achievementRepository.save(template)
            );
        }

        for (Achievement existing : achievementRepository.findAll()) {
            if (!templateKeys.contains(existing.getAchievementKey())) {
                userAchievementRepository.deleteByAchievement(existing);
                achievementRepository.delete(existing);
            }
        }

        logger.info("Catálogo de logros sincronizado: {} logros.", achievementRepository.count());
    }

    private List<Achievement> buildAchievements() {
        return List.of(

            // --- PARTIDAS ---
            achievement("FIRST_MATCH",  "Primera partida",       "Juega tu primera partida.",               AchievementCategory.MATCH,     1,   5, AchievementRank.BRONCE),
            achievement("PLAY_10",      "En racha",              "Juega 10 partidas.",                      AchievementCategory.MATCH,    10,  15, AchievementRank.PLATA),
            achievement("PLAY_50",      "Veterano",              "Juega 50 partidas.",                      AchievementCategory.MATCH,    50,  30, AchievementRank.ORO),
            achievement("PLAY_100",     "Leyenda del Maná",      "Juega 100 partidas.",                     AchievementCategory.MATCH,   100,  75, AchievementRank.PLATINO),

            // --- VICTORIAS ---
            achievement("FIRST_WIN",    "Primera victoria",      "Gana tu primera partida.",                AchievementCategory.MATCH,     1,  10, AchievementRank.BRONCE),
            achievement("WIN_10",       "Imparable",             "Gana 10 partidas.",                       AchievementCategory.MATCH,    10,  25, AchievementRank.PLATA),
            achievement("WIN_50",       "Dominador",             "Gana 50 partidas.",                       AchievementCategory.MATCH,    50,  60, AchievementRank.ORO),
            achievement("WIN_100",      "Campeón del Multiverso","Gana 100 partidas.",                      AchievementCategory.MATCH,   100, 150, AchievementRank.DIAMANTE),

            // --- MAZOS ---
            achievement("FIRST_DECK",   "Arquitecto",            "Crea tu primer mazo.",                    AchievementCategory.DECK,      1,  10, AchievementRank.BRONCE),
            achievement("DECK_5",       "Coleccionista",         "Crea 5 mazos distintos.",                 AchievementCategory.DECK,      5,  25, AchievementRank.PLATA),
            achievement("DECK_10",      "Maestro Constructor",   "Crea 10 mazos distintos.",                AchievementCategory.DECK,     10,  50, AchievementRank.ORO),
            achievement("DECK_50",      "Gran Arquitecto",       "Crea 50 mazos distintos.",                AchievementCategory.DECK,     50, 200, AchievementRank.DIAMANTE),

            // --- SOCIAL ---
            achievement("FIRST_FRIEND",   "No estás solo",         "Añade tu primer amigo.",                  AchievementCategory.SOCIAL,    1,  10, AchievementRank.BRONCE),
            achievement("FRIENDS_5",      "Popular",               "Llega a 5 amigos.",                       AchievementCategory.SOCIAL,    5,  20, AchievementRank.PLATA),
            achievement("FRIENDS_10",     "El alma de la fiesta",  "Llega a 10 amigos.",                      AchievementCategory.SOCIAL,   10,  40, AchievementRank.ORO),
            achievement("FIRST_MESSAGE",  "Primer contacto",       "Envía tu primer mensaje a un amigo.",     AchievementCategory.SOCIAL,    1,  10, AchievementRank.BRONCE),
            achievement("CHAT_100",      "Conversador",           "Envía 100 mensajes a otros usuarios.",     AchievementCategory.SOCIAL,  100,  30, AchievementRank.PLATA),
            achievement("CHAT_500",      "Comunicador nato",      "Envía 500 mensajes a otros usuarios.",     AchievementCategory.SOCIAL,  500,  70, AchievementRank.ORO),
            achievement("NEWS_FIRST",    "Informado",             "Visita Noticias por primera vez.",         AchievementCategory.SOCIAL,    1,  10, AchievementRank.BRONCE),
            achievement("NEWS_10",       "Lector frecuente",      "Visita Noticias 10 veces.",                AchievementCategory.SOCIAL,   10,  25, AchievementRank.PLATA),
            achievement("NEWS_50",       "Cronista",              "Visita Noticias 50 veces.",                AchievementCategory.SOCIAL,   50,  60, AchievementRank.ORO),
            achievement("NEWS_200",      "Analista",              "Visita Noticias 200 veces.",               AchievementCategory.SOCIAL,  200, 100, AchievementRank.PLATINO),
            achievement("NEWS_1000",     "Enciclopedia viva",     "Visita Noticias 1000 veces.",              AchievementCategory.SOCIAL, 1000, 200, AchievementRank.DIAMANTE),

            // --- VISTA DE CARTA ---
            achievement("CARD_VIEW_FIRST",    "Curioso",              "Mira el detalle de una carta por primera vez.", AchievementCategory.SOCIAL,    1,   5, AchievementRank.BRONCE),
            achievement("CARD_VIEW_10",       "Curioso habitual",     "Mira el detalle de 10 cartas.",                   AchievementCategory.SOCIAL,   10,  25, AchievementRank.PLATA),
            achievement("CARD_VIEW_50",       "Ojeador",              "Mira el detalle de 50 cartas.",                   AchievementCategory.SOCIAL,   50,  60, AchievementRank.ORO),
            achievement("CARD_VIEW_200",      "Coleccionista visual", "Mira el detalle de 200 cartas.",                  AchievementCategory.SOCIAL,  200, 100, AchievementRank.PLATINO),
            achievement("CARD_VIEW_1000",     "Archivista",           "Mira el detalle de 1000 cartas.",                 AchievementCategory.SOCIAL, 1000, 200, AchievementRank.DIAMANTE),
            
            // --- PERFIL ---
            achievement("PROFILE_EDIT",  "Perfil actualizado",   "Actualiza los datos de tu perfil.",      AchievementCategory.SOCIAL,    1,   5, AchievementRank.BRONCE),
            // --- FAVORITOS (CARTAS) ---
            achievement("FAVORITES_FIRST",   "Corazón inicial",       "Marca tu primera carta como favorita.",      AchievementCategory.SOCIAL,    1,  10, AchievementRank.BRONCE),
            achievement("FAVORITES_10",      "Coleccionista aficionado","Marca 10 cartas como favoritas.",            AchievementCategory.SOCIAL,   10,  25, AchievementRank.PLATA),
            achievement("FAVORITES_50",      "Favoritólogo",          "Marca 50 cartas como favoritas.",             AchievementCategory.SOCIAL,   50,  60, AchievementRank.ORO),
            achievement("FAVORITES_200",     "Curador",              "Marca 200 cartas como favoritas.",            AchievementCategory.SOCIAL,  200, 100, AchievementRank.PLATINO),
            achievement("FAVORITES_1000",    "Biblioteca viviente",  "Marca 1000 cartas como favoritas.",           AchievementCategory.SOCIAL, 1000, 200, AchievementRank.DIAMANTE),

            // --- USUARIOS ---
            achievement("USERS_FIRST",     "Explorador social",    "Entra a la lista de usuarios por primera vez.", AchievementCategory.SOCIAL,    1,  10, AchievementRank.BRONCE),
            achievement("USERS_10",        "Vigilante",            "Entra a la lista de usuarios 10 veces.",        AchievementCategory.SOCIAL,   10,  25, AchievementRank.PLATA),
            achievement("USERS_50",        "Observador",           "Entra a la lista de usuarios 50 veces.",        AchievementCategory.SOCIAL,   50,  60, AchievementRank.ORO),
            achievement("USERS_200",       "Rastreador",           "Entra a la lista de usuarios 200 veces.",       AchievementCategory.SOCIAL,  200, 100, AchievementRank.PLATINO),
            achievement("USERS_1000",      "Ojo del multiverso",    "Entra a la lista de usuarios 1000 veces.",      AchievementCategory.SOCIAL, 1000, 200, AchievementRank.DIAMANTE),

            // --- HITOS DE ELO ---
            achievement("ELO_1400",     "Ascendiendo",           "Alcanza 1400 puntos de ELO.",             AchievementCategory.MILESTONE, 1,  30, AchievementRank.PLATA),
            achievement("ELO_1600",     "Élite",                 "Alcanza 1600 puntos de ELO.",             AchievementCategory.MILESTONE, 1,  60, AchievementRank.ORO),
            achievement("ELO_2000",     "Grandmaster",           "Alcanza 2000 puntos de ELO.",             AchievementCategory.MILESTONE, 1, 100, AchievementRank.PLATINO),
            achievement("ELO_2400",     "Inmortal",              "Alcanza 2400 puntos de ELO.",             AchievementCategory.MILESTONE, 1, 200, AchievementRank.DIAMANTE)
        );
    }

    private Achievement achievement(String key, String name, String description,
                                    AchievementCategory category, int targetValue, int points,
                                    AchievementRank rango) {
        Achievement a = new Achievement();
        a.setAchievementKey(key);
        a.setName(name);
        a.setDescription(description);
        a.setCategory(category);
        a.setIconUrl(iconForCategory(category));
        a.setTargetValue(targetValue);
        a.setPoints(points);
        a.setRango(rango);
        return a;
    }

    private String iconForCategory(AchievementCategory category) {
        return switch (category) {
            case MATCH -> "sports_esports";
            case DECK -> "style";
            case SOCIAL -> "group";
            case MILESTONE -> "military_tech";
        };
    }
}
