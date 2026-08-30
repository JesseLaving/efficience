import { beforeEach, describe, expect, it } from 'vitest';
import {
  addScheduled,
  defaultDateTime,
  loadScheduled,
  publishedCaptions,
  removeScheduled,
  toLocalIso,
  updateScheduled,
  type ScheduledPost,
} from './calendar';

const post = (dateTime: string, over: Partial<ScheduledPost> = {}) => ({
  dateTime,
  text: 'Texte',
  networks: ['instagram'],
  ...over,
});

describe('calendrier de programmation', () => {
  beforeEach(() => localStorage.clear());

  it('écrit la date en heure locale, jamais en UTC', () => {
    // toISOString() décalerait la date d'un jour en soirée sous UTC+2 : une
    // publication du 6 au soir se retrouverait datée du 7.
    const d = new Date(2026, 7, 6, 23, 30);
    expect(toLocalIso(d)).toBe('2026-08-06T23:30');
  });

  it('complète une date seule avec l’heure par défaut', () => {
    expect(defaultDateTime('2026-07-02')).toBe('2026-07-02T09:00');
    expect(defaultDateTime('2026-07-02', 18)).toBe('2026-07-02T18:00');
  });

  it('garde la file triée par date d’envoi', () => {
    let list = addScheduled([], post('2026-08-10T09:00'));
    list = addScheduled(list, post('2026-08-02T09:00'));
    list = addScheduled(list, post('2026-08-06T09:00'));
    expect(list.map((p) => p.dateTime)).toEqual([
      '2026-08-02T09:00',
      '2026-08-06T09:00',
      '2026-08-10T09:00',
    ]);
  });

  it('persiste la file pour la retrouver au rechargement', () => {
    const list = addScheduled([], post('2026-08-02T09:00'));
    expect(loadScheduled().map((p) => p.id)).toEqual(list.map((p) => p.id));
  });

  it('retrie après un déplacement de date', () => {
    let list = addScheduled([], post('2026-08-02T09:00'));
    list = addScheduled(list, post('2026-08-06T09:00'));
    list = updateScheduled(list, list[0].id, { dateTime: '2026-08-09T09:00' });
    expect(list.map((p) => p.dateTime)).toEqual(['2026-08-06T09:00', '2026-08-09T09:00']);
  });

  it('supprime sans toucher aux autres publications', () => {
    let list = addScheduled([], post('2026-08-02T09:00'));
    list = addScheduled(list, post('2026-08-06T09:00'));
    const kept = list[1].id;
    list = removeScheduled(list, list[0].id);
    expect(list.map((p) => p.id)).toEqual([kept]);
    expect(loadScheduled()).toHaveLength(1);
  });

  it('ne propose comme références que les publications réellement parties', () => {
    let list = addScheduled([], post('2026-08-02T09:00', { text: 'Publié', status: 'published' }));
    list = addScheduled(list, post('2026-08-06T09:00', { text: 'Programmé' }));
    list = addScheduled(list, post('2026-08-04T09:00', { text: 'Échec', status: 'failed' }));
    // Des plus récentes aux plus anciennes, et rien qui ne soit passé en ligne.
    expect(publishedCaptions(list)).toEqual(['Publié']);
  });

  it('survit à un stockage corrompu au lieu de casser l’écran', () => {
    localStorage.setItem('eff_calendar_v1', '{ pas du json');
    expect(loadScheduled()).toEqual([]);
  });
});
