import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatchService } from '../../../core/services/match.service';
import { ProfileService, UserProfile } from '../../../core/services/profile.service';
import { Match } from '../../../models/match.model';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { MatchmakingModalComponent } from '../../../shared/components/matchmaking-modal/matchmaking-modal.component';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-match-browser',
  standalone: true,
  imports: [CommonModule, RouterModule, AvatarComponent, MatchmakingModalComponent],
  templateUrl: './match-browser.component.html',
  styleUrl: './match-browser.component.scss'
})
export class MatchBrowserComponent implements OnInit {
  private matchService = inject(MatchService);
  private profileService = inject(ProfileService);
  private cdr = inject(ChangeDetectorRef);

  liveMatches: Match[] = [];
  historyMatches: Match[] = [];
  userProfile: UserProfile | null = null;
  isLoading = true;
  isMatchmakingModalOpen = false;

  expandedMatchId: string | null = null;
  expandedDeck: string | null = null;

  toggleExpandedDeck(deck: string): void {
    this.expandedDeck = this.expandedDeck === deck ? null : deck;
  }

  ngOnInit(): void {
    this.loadMatches();
  }

  loadMatches(): void {
    this.isLoading = true;
    
    forkJoin({
      live: this.matchService.getLiveMatches(),
      history: this.matchService.getMatchHistory(),
      profile: this.profileService.getMyProfile()
    }).subscribe({
      next: (result) => {
        this.liveMatches = result.live;
        this.historyMatches = result.history;
        this.userProfile = result.profile;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading data', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  get winRate(): number | null {
    if (!this.userProfile) return null;
    if (this.userProfile.gamesPlayed === 0) return 0;
    return Math.round((this.userProfile.gamesWon / this.userProfile.gamesPlayed) * 100);
  }

  toggleExpand(matchId: string): void {
    if (this.expandedMatchId === matchId) {
      this.expandedMatchId = null;
    } else {
      this.expandedMatchId = matchId;
    }
  }

  getColorClass(colorCode: string): string {
    const map: { [key: string]: string } = {
      'W': 'bg-zinc-100',
      'U': 'bg-blue-500',
      'B': 'bg-zinc-800',
      'R': 'bg-rose-500',
      'G': 'bg-emerald-500'
    };
    return map[colorCode] || 'bg-zinc-500';
  }

  isWinner(match: Match): boolean {
    return match.winner === 'Current_User';
  }

  getEloDisplay(match: Match): string {
    if (match.eloChange === null || match.eloChange === undefined) return '';
    const val = this.isWinner(match) ? Math.abs(match.eloChange) : -Math.abs(match.eloChange);
    return (val > 0 ? '+' : '') + val + ' ELO';
  }
}
