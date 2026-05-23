import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'manaCost', standalone: true })
export class ManaCostPipe implements PipeTransform {
  transform(value: string | string[] | null | undefined): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    const matches = value.match(/\{([^}]+)\}/g);
    if (!matches) return [];
    return matches.map(m => m.replace(/[{}\/]/g, ''));
  }
}
