import { createContext, useCallback, useContext, useState } from 'react';
import { loadContacts, saveContacts, mergeContacts, type Contact } from '../lib/contacts';

/* Base clients réelle — importée par fichier ou Google Contacts (jamais
   inventée). Persistée en localStorage, synchronisée par espace via
   AuthWrapper (snapshot générique de toutes les clés). */
export interface ImportStats { imported: number; added: number; updated: number; }

interface ContactsCtx {
  contacts: Contact[];
  addContacts: (incoming: Contact[]) => ImportStats;
  removeContact: (id: string) => void;
  clearContacts: () => void;
}

const Ctx = createContext<ContactsCtx | null>(null);

export function ContactsProvider({ children }: { children: React.ReactNode }) {
  const [contacts, setContacts] = useState<Contact[]>(() => loadContacts());

  const addContacts = useCallback((incoming: Contact[]): ImportStats => {
    const merged = mergeContacts(contacts, incoming);
    const added = merged.length - contacts.length;
    const stats: ImportStats = { imported: incoming.length, added, updated: incoming.length - added };
    saveContacts(merged);
    setContacts(merged);
    return stats;
  }, [contacts]);

  const removeContact = useCallback((id: string) => {
    setContacts((prev) => {
      const next = prev.filter((c) => c.id !== id);
      saveContacts(next);
      return next;
    });
  }, []);

  const clearContacts = useCallback(() => { setContacts([]); saveContacts([]); }, []);

  return <Ctx.Provider value={{ contacts, addContacts, removeContact, clearContacts }}>{children}</Ctx.Provider>;
}

export function useContacts(): ContactsCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useContacts must be used within ContactsProvider');
  return c;
}
