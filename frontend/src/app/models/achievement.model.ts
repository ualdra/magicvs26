export type AchievementCategory = 'MATCH' | 'DECK' | 'SOCIAL' | 'MILESTONE';

export type AchievementRank = 'BRONCE' | 'PLATA' | 'ORO' | 'PLATINO' | 'DIAMANTE';

export interface Achievement {
  id: number;
  key: string;
  name: string;
  description: string;
  category: AchievementCategory;
  iconUrl: string | null;
  points: number;
  targetValue: number;
  rango: AchievementRank;
}

export interface UserAchievement {
  achievement: Achievement;
  progressValue: number;
  unlocked: boolean;
  earnedAt: string | null;
}
