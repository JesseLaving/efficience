import { useEffect, useState } from 'react';

/* Loader dédié aux générations IA et analyses (Studio, Planning éditorial,
   Campagnes, Analyse) — un anneau animé + un fil de statuts qui tourne,
   pour donner une perception de progrès pendant les appels IA/API qui
   prennent plusieurs secondes, plutôt qu'un simple spinner immobile. */
export function AiLoader({
  lead, phrases, interval = 1700, dark = false, compact = false,
}: { lead?: React.ReactNode; phrases: string[]; interval?: number; dark?: boolean; compact?: boolean }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (phrases.length < 2) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % phrases.length), interval);
    return () => window.clearInterval(id);
  }, [phrases.length, interval]);

  return (
    <div className={'ai-loader' + (dark ? ' dark' : '') + (compact ? ' compact' : '')}>
      <div className="ai-loader-orb"><div className="ai-loader-ring" /></div>
      <div className="ai-loader-body">
        {lead && <div className="ai-loader-lead">{lead}</div>}
        <div className="ai-loader-cycle"><span key={i}>{phrases[i % phrases.length]}</span></div>
      </div>
    </div>
  );
}
