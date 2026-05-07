import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AchievementService } from '../../core/services/achievement.service';
import { Achievement, AchievementCategory, AchievementRank, UserAchievement } from '../../models/achievement.model';

interface EnrichedAchievement {
  achievement: Achievement;
  progressValue: number;
  unlocked: boolean;
  earnedAt: string | null;
}

@Component({
  selector: 'app-achievements-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './achievements-page.component.html',
})
export class AchievementsPageComponent implements OnInit {
  private readonly achievementService = inject(AchievementService);

  readonly loading = signal(true);
  readonly items = signal<EnrichedAchievement[]>([]);
  readonly selectedCategory = signal<AchievementCategory | 'ALL'>('ALL');

  readonly categories: { value: AchievementCategory | 'ALL'; label: string }[] = [
    { value: 'ALL',       label: 'Todos' },
    { value: 'MATCH',     label: 'Partidas' },
    { value: 'DECK',      label: 'Mazos' },
    { value: 'SOCIAL',    label: 'Social' },
    { value: 'MILESTONE', label: 'Hitos' },
  ];

  readonly filtered = computed(() => {
    const cat = this.selectedCategory();
    return cat === 'ALL'
      ? this.items()
      : this.items().filter(i => i.achievement.category === cat);
  });

  readonly unlockedCount = computed(() => this.items().filter(i => i.unlocked).length);

  readonly isLoggedIn = !!localStorage.getItem('token') || !!localStorage.getItem('authToken');

  ngOnInit(): void {
    const userAchievements$ = this.isLoggedIn
      ? this.achievementService.getMyAchievements().pipe(catchError(() => of([] as UserAchievement[])))
      : of([] as UserAchievement[]);

    forkJoin({
      all: this.achievementService.getAllAchievements(),
      mine: userAchievements$,
    }).subscribe({
      next: ({ all, mine }) => {
        const progressMap = new Map<string, UserAchievement>(mine.map(ua => [ua.achievement.key, ua]));
        this.items.set(all.map(a => {
          const ua = progressMap.get(a.key);
          return {
            achievement: a,
            progressValue: ua?.progressValue ?? 0,
            unlocked: ua?.unlocked ?? false,
            earnedAt: ua?.earnedAt ?? null,
          };
        }));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  progressPercent(item: EnrichedAchievement): number {
    const target = item.achievement.targetValue;
    if (target <= 1) return 0;
    return Math.min(100, Math.round((item.progressValue / target) * 100));
  }

  formatDate(value: string | null): string {
    if (!value) return '';
    return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(value));
  }

  categoryIcon(category: string): string {
    const icons: Record<string, string> = {
      MATCH: 'sports_esports',
      DECK: 'style',
      SOCIAL: 'group',
      MILESTONE: 'military_tech',
    };
    return icons[category] ?? 'emoji_events';
  }

  rankColor(rango: AchievementRank | string | null | undefined): string {
    const colors: Record<string, string> = {
      BRONCE:   'text-amber-600',
      PLATA:    'text-slate-300',
      ORO:      'text-yellow-400',
      PLATINO:  'text-blue-400',
      DIAMANTE: 'text-white',
    };
    return (rango && colors[rango]) ?? 'text-zinc-400';
  }
}
