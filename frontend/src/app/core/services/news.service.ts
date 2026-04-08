import { Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { News } from '../../models/news.model';

@Injectable({
  providedIn: 'root'
})
export class NewsService {
  private mockNews: News[] = [
    {
      id: 1,
      title: 'Cambios drásticos en Pioneer: Prohibiciones y restricciones de Mayo',
      summary: 'El comité de equilibrio ha emitido un comunicado urgente respecto a la dominancia de ciertos mazos Combo. Revisa la lista completa de cartas afectadas y el razonamiento oficial.',
      url: '#',
      imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCgBqWSJZMjTADDcpNfPYygAXAfbgP8_QyeOqSnQ8KWKH2gAF6lgrdKODzFGF8fI2sLgQgyiJ9HxzcXhzj1y_fYLYpzQ40OFc6H9N4i7NukmsKmul3k9gua6G0pjs3fjzS-VrIWkttn_TBp8crKC6SaW-iqpwsoxPy71zFmOoczz8r7BCLIgTcfA0IJrDOp1xErZ9LLMnqFiGEk71ZUJEm-ZOw9mh6-BTp61ZwII-_Pc53Z3paDCsrkd9CIXdLE9x3kkTKbUSN4nfHm',
      date: 'Hace 2 horas',
      category: 'Banlist Update',
      categoryClass: 'bg-primary text-on-primary'
    },
    {
      id: 2,
      title: 'Nuevas filtraciones de Modern Horizons 3: El regreso de los Eldrazi',
      summary: 'Los susurros desde el vacío se intensifican. Analizamos las mecánicas filtradas que prometen sacudir el formato Modern de pies a cabeza.',
      url: '#',
      imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBHgY3m-l2vX5zLQ_VCWnJYPnIVsg7SjEd7cIpos2muTD0o7QZ-tSo4RemrgfLF1bm-RkoanLDGSmTetGQCRnkq0dimbSDCnC-Rt9bkNi2FYfdqDBGhHtqawl5iaPkrsb7ZOfMEtIoLDRO2YlVB4QFf-xT7JZIOMkcIqPgNe-DNydAd94mYQptBzVbynKbE_p_NeJQgEuEDX0gfLr3zIgXyp0GpOrHLszfMj9RGLKz1D1CCg8FDJ94mNz8dT7brjygqr1KY2acPvG-P',
      date: 'Hace 5 horas',
      category: 'Spoiler Season',
      categoryClass: 'bg-tertiary text-on-tertiary'
    },
    {
      id: 3,
      title: 'Guía Estratégica: Cómo vencer al mazo Tier 0 de la temporada',
      summary: 'Expertos del circuito profesional comparten las mejores opciones de banquillo y líneas de juego para contrarrestar la hegemonía actual.',
      url: '#',
      imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAC-rnq7rbgsm-KgczVIQFrcr7GSMCzKkq6xV0xY3dY8lJez90zA75K2fOqv9IFOGnc6mR_oDZSzqHRdbSSikvCDsKq7bFtWmTFFdqm7OJe5wwYU_4Wddab23GcaeknbBdiRzqFMxbaN2BsN-tnBjeHTLA525yCzmYk8YyO7ARTf--pF_OsmJWmdme_qAJibP52BFxCd3W396udYQgWGNUoob8iufoQYh0Na3Zn0sdkVTZIhDIaCRq1vZXo_RxEy5cGLswEf9W6_xWv',
      date: 'Ayer',
      category: 'Pro Tour',
      categoryClass: 'bg-surface-bright text-on-surface'
    },
    {
      id: 4,
      title: 'MTG Arena Open: Premios en efectivo y formato sellado',
      summary: 'Prepara tus gemas. El evento más competitivo del cliente digital regresa este fin de semana con recompensas masivas para los mejores clasificados.',
      url: '#',
      imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAMzu9Y8HCwwOMCgHki_8W-aIQw3qJUnnw4Tu6jaXYN8ml57rDvWDD7tWgD3TWmhM5dkbKmZZcYDY3klFbDy6nmrvw4TERFPNM7EqZqbQTLZKELTYVEloChlz-RRWVRnAcM8X2Crm5VSlHHyaPClaUssJEjT90zkBzM_P8QTJ1S1J0UWuyeBRa3nLXKIONNrawji-_pp8or-0zUrCpEFFlGZpeJUd1RoIWWzGtfN-1ffIKZSLejJj9Nb4XTkQNwjYVdDmAFAMPRzrOb',
      date: 'Hace 1 día',
      category: 'MTG Arena',
      categoryClass: 'bg-secondary text-on-secondary'
    },
    {
      id: 5,
      title: "El auge de los mazos 'Midrange' en EDH Multijugador",
      summary: '¿Ha muerto el combo rápido? Analizamos por qué las mesas locales están optando por estrategias de valor acumulado y resiliencia.',
      url: '#',
      imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA2dPPHOkUalpNUQmJbkqKH6oymdltSwH9DPpMLtCfLhfaa-_T5f0hksX3gE1teHO_uN-ltUVmDscdhqZmFZaPFgK1WKcZpeXW1tPNfuh85eXFcfak3TASPMrpeFQVOhGkM0vb3Ojwe-F2RMVnrtPuDvJ7obBLJGdrmF51aIKQfWASxZN63RjPeCrL7ktljeVXPp4FA_RLLdbzSRVxXjWKnNWZ8uZmM5ypT1nXM9CSmPSYc_QasFCCPGZFykQ_4cgOshOQNPASqfGYl',
      date: 'Hace 3 días',
      category: 'Commander',
      categoryClass: 'bg-primary-container text-on-primary-container'
    },
    {
      id: 6,
      title: 'Análisis del mercado: Cartas de la Reserved List en alza',
      summary: 'Observamos un repunte inusual en el valor de las dual lands y artefactos icónicos. ¿Burbuja o inversión sólida?',
      url: '#',
      imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBPmtc-7ARniHIfJIandBV-bey4AF22yeFVli8vbG_Boni9jsQEKczHTt8k9NhOsfAig5LYjU6AyVwHh-tVUIH5ogbtykcqPLYdiqX08YdW9k1AoOnOh9W9ffYWM2gtlQ2TQAofKAOohK4nXHiEnfmGBuuBNrzcrq0WUwmUIRVm6GlfTBSzNyQBvj63bTXkQ2L0f9hP-_l1zj1XttUSVggVWKPjgWTHSSs1cbay7e-XO_RGfXCEySni2dD1Je7yyGWQu-jzPNm0CqPb',
      date: 'Hace 1 semana',
      category: 'Finanzas',
      categoryClass: 'bg-surface-variant text-on-surface-variant'
    }
  ];

  getNews(): Observable<News[]> {
    return of(this.mockNews);
  }
}
