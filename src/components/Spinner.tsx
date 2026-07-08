
/** Spinner compact pour boutons et champs (15px) */
export function SpinnerSmall() {
  return <span className="spin" style={{ width: 14, height: 14 }} />;
}

/** Spinner moyen pour modales et panneaux (20px) */
export function SpinnerMedium() {
  return <span className="spin" style={{ width: 18, height: 18 }} />;
}

/** Spinner large pour écrans (26px) */
export function SpinnerLarge() {
  return <span className="spin" style={{ width: 26, height: 26 }} />;
}

/** Animated loading text for async operations */
export function LoadingText({ children = 'Chargement…' }: { children?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <SpinnerSmall />
      {children}
    </span>
  );
}
