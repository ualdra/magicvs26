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
      { path: 'cartas', component: CatalogComponent },
      { path: 'cartas/:id', component: CardDetailComponent },
      { path: 'verify/:pendingId', component: Verification },
      { path: 'profile', pathMatch: 'full', redirectTo: 'profile/me' },
      { path: 'profile/:userId/decks', component: ProfilePageComponent },
      { path: 'profile/:userId', component: ProfilePageComponent }
    ]
  }
];