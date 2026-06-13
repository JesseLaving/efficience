import { UI, BRAND } from './icons';

/** Renders a UI icon (stroke, currentColor) inside a `.ic` span. */
export function Icon({ name, className, style }: { name: keyof typeof UI; className?: string; style?: React.CSSProperties }) {
  return <span className={'ic ' + (className || '')} style={style} dangerouslySetInnerHTML={{ __html: UI[name] }} />;
}

/** Renders a brand glyph (filled, brand-colored). Bare SVG, not wrapped in `.ic`. */
export function Brand({ name }: { name: keyof typeof BRAND }) {
  return <span style={{ display: 'inline-grid', placeItems: 'center', lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: BRAND[name] }} />;
}

/** Renders an arbitrary raw SVG string inside a `.ic` span (for dynamic icon names). */
export function RawIcon({ svg, className, style }: { svg: string; className?: string; style?: React.CSSProperties }) {
  return <span className={'ic ' + (className || '')} style={style} dangerouslySetInnerHTML={{ __html: svg }} />;
}
