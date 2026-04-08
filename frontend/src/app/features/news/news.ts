import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NewsService } from '../../core/services/news.service';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-news',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './news.html',
  styleUrls: ['./news.scss']
})
export class NewsComponent {
  private newsService = inject(NewsService);

  // Convert the observable to a signal for easy use in the template
  public news = toSignal(this.newsService.getNews(), { initialValue: [] });
}
