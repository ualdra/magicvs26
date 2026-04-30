import { Routes } from '@angular/router';
import { MainLayout } from './layouts/main-layout/main-layout';
import { Home } from './features/home/home';
import { NewsComponent } from './features/news/news';
import { MetaComponent } from './features/meta/meta';
import { Login } from './features/login/login';
import { Registro } from './features/registro/registro';
import { CatalogComponent } from './features/catalog/catalog';
import { CardDetailComponent } from './features/catalog/card-detail';
import { Verification } from './features/verification/verification';
import { ProfilePageComponent } from './features/profile/profile-page.component';
import { DeckBuilderPageComponent } from './features/deck-builder/deck-builder-page.component';
import { authGuard } from './core/guards/auth.guard';
import { UserDirectoryComponent } from './features/users/user-directory/user-directory.component';
import { UserProfileComponent } from './features/users/user-profile/user-profile.component';
import { OAuthConfirm } from './features/oauth-confirm/oauth-confirm';
import { ResetPassword } from './features/reset-password/reset-password';
import { DeckDetailComponent } from './features/decks/deck-detail/deck-detail.component';
import { MatchBrowserComponent } from './features/arena/match-browser/match-browser.component';
import { BattleboardComponent } from './features/battle/battleboard/battleboard.component';

export const routes: Routes = [
  {
    path: '',
    component: MainLayout,
    children: [
      { path: '', component: Home },
      { path: 'noticias', component: NewsComponent },
      { path: 'meta', component: MetaComponent },
      { path: 'login', component: Login },
      { path: 'registro', component: Registro },
      { path: 'register/confirm', component: OAuthConfirm },
      { path: 'cartas', component: CatalogComponent },
      { path: 'cartas/:id', component: CardDetailComponent },
      { path: 'verify/:pendingId', component: Verification },
      { path: 'profile', pathMatch: 'full', redirectTo: 'profile/me' },
      { path: 'profile/:userId/decks', component: ProfilePageComponent },
      { path: 'profile/:userId', component: ProfilePageComponent },
      { path: 'decks/create', component: DeckBuilderPageComponent, canActivate: [authGuard] },
      { path: 'decks/:deckId/edit', component: DeckBuilderPageComponent, canActivate: [authGuard] },
      { path: 'decks/:id', component: DeckDetailComponent },
      { path: 'users', component: UserDirectoryComponent },
      { path: 'users/:id', component: UserProfileComponent },
      { path: 'arena', component: MatchBrowserComponent, canActivate: [authGuard] },
      { path: 'battle/:id', component: BattleboardComponent, canActivate: [authGuard] },
      { path: 'reset-password/:token', component: ResetPassword }
    ]
  }
];