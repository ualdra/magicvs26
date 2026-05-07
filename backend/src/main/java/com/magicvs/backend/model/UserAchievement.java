package com.magicvs.backend.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_achievements", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"user_id", "achievement_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserAchievement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "achievement_id", nullable = false)
    private Achievement achievement;

    // Progreso actual hacia el logro (ej: 23 de 50 victorias)
    @Builder.Default
    @Column(name = "progress_value", nullable = false)
    private Integer progressValue = 0;

    // Fecha en que se desbloqueó; null = todavía no desbloqueado
    @Column(name = "earned_at")
    private LocalDateTime earnedAt;

    public boolean isUnlocked() {
        return this.earnedAt != null;
    }
}
