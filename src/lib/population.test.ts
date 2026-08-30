import { describe, expect, it } from 'vitest';
import { fieldsFor, matchCriteria, type Criterion } from './population';
import type { Contact } from './contacts';

const contact = (over: Partial<Contact> = {}): Contact => ({
  id: 'c1',
  first: 'Camille',
  last: 'Durand',
  name: 'Camille Durand',
  email: 'camille@exemple.com',
  ...over,
}) as Contact;

const base = [
  contact({ id: 'a', city: 'Avignon', basket: 80, lastDays: 10, consent: true, tags: ['VIP'] }),
  contact({ id: 'b', city: 'Nîmes', basket: 20, lastDays: 200, consent: false, tags: [] }),
];
const fields = fieldsFor(base);
const match = (c: Contact, criteria: Criterion[]) => matchCriteria(c, criteria, fields);

describe('segmentation de la base clients', () => {
  it('propose comme villes celles des contacts réels', () => {
    expect(fields.city.options).toEqual(['Avignon', 'Nîmes']);
  });

  it('n’invente pas de ville quand la base n’en contient aucune', () => {
    expect(fieldsFor([contact({ city: undefined })]).city.options).toEqual(['—']);
  });

  it('filtre sur la ville, dans les deux sens', () => {
    expect(match(base[0], [{ field: 'city', op: 'est', value: 'Avignon' }])).toBe(true);
    expect(match(base[1], [{ field: 'city', op: 'est', value: 'Avignon' }])).toBe(false);
    expect(match(base[1], [{ field: 'city', op: 'n’est pas', value: 'Avignon' }])).toBe(true);
  });

  it('traite un panier absent comme zéro, pas comme un panier élevé', () => {
    const sansAchat = contact({ basket: undefined });
    expect(match(sansAchat, [{ field: 'basket', op: 'supérieur à', value: '50' }])).toBe(false);
    expect(match(sansAchat, [{ field: 'basket', op: 'inférieur à', value: '50' }])).toBe(true);
  });

  it('place un contact sans achat connu du côté des inactifs', () => {
    // lastDays absent = jamais acheté : le compter comme un achat récent
    // l'enverrait dans une relance « clients fidèles » à tort.
    const jamais = contact({ lastDays: undefined });
    expect(match(jamais, [{ field: 'lastDays', op: 'il y a moins de', value: '30' }])).toBe(false);
    expect(match(jamais, [{ field: 'lastDays', op: 'il y a plus de', value: '30' }])).toBe(true);
  });

  it('ne considère consentant qu’un consentement explicite', () => {
    const inconnu = contact({ consent: undefined });
    const accepte: Criterion[] = [{ field: 'consent', op: 'est', value: 'Accepté' }];
    expect(match(base[0], accepte)).toBe(true);
    expect(match(base[1], accepte)).toBe(false);
    expect(match(inconnu, accepte)).toBe(false);
    expect(match(inconnu, [{ field: 'consent', op: 'est', value: 'Refusé' }])).toBe(true);
  });

  it('combine les critères en ET', () => {
    const criteria: Criterion[] = [
      { field: 'city', op: 'est', value: 'Avignon' },
      { field: 'basket', op: 'supérieur à', value: '50' },
    ];
    expect(match(base[0], criteria)).toBe(true);
    expect(match(contact({ city: 'Avignon', basket: 10 }), criteria)).toBe(false);
  });

  it('filtre sur les tags', () => {
    expect(match(base[0], [{ field: 'tag', op: 'contient', value: 'VIP' }])).toBe(true);
    expect(match(base[1], [{ field: 'tag', op: 'contient', value: 'VIP' }])).toBe(false);
  });

  it('ignore un critère portant sur un champ inconnu plutôt que de tout exclure', () => {
    expect(match(base[0], [{ field: 'inexistant', op: 'est', value: 'x' }])).toBe(true);
  });
});
