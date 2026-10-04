import type { ReactNode } from 'react';

type PanelLayoutProps = {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
};

function PanelLayout({ title, subtitle, icon, actions, children }: PanelLayoutProps) {
  return (
    <section className="h-full flex flex-col gap-4 p-4">
      <header className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <h1 className="font-display text-lg text-white">{title}</h1>
            {subtitle && <p className="text-xs text-white/40">{subtitle}</p>}
          </div>
        </div>
        {actions}
      </header>
      <div className="flex-1 min-h-0">{children}</div>
    </section>
  );
}

/**
 * Example Panel Component Template
 *
 * Replace TEMPLATE_NAME, TITLE, ICON, and add your panel-specific state/logic.
 * All styling should use TailwindCSS classes (no style={} objects).
 * Use design system utilities: .glass, .glass-crimson, .glow-crimson, .text-teal, .font-display
 */

type TemplatePanelProps = {
  // Add your props here
  // Example: title?: string;
};

export default function TemplatePanel(props: TemplatePanelProps) {
  // Destructure props here if needed
  // Example: const { title } = props;
  // Add your state and handlers here
  // Example: const [items, setItems] = useState<Item[]>([]);

  return (
    <PanelLayout
      title="Template Panel"
      subtitle="Panel description"
      icon={<div className="w-4 h-4 rounded bg-primary/30" />}
      actions={
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass text-white/50 text-xs font-display hover:text-white/80 transition-all">
            Action 1
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-crimson text-primary text-xs font-display hover:glow-crimson-sm transition-all">
            Action 2
          </button>
        </div>
      }
    >
      <div className="h-full flex flex-col gap-4">
        {/* Main content area */}
        <div className="flex-1 grid grid-cols-3 gap-4 overflow-y-auto">
          {/* Example card */}
          <div className="glass rounded-xl border border-white/8 p-4 hover:border-primary/25 transition-colors">
            <div className="w-10 h-10 rounded-lg glass-crimson flex items-center justify-center mb-3">
              <span className="text-primary/70">📊</span>
            </div>
            <div className="text-xs text-white/70 font-medium mb-1">Card Title</div>
            <div className="text-[10px] text-white/30 leading-relaxed">
              Card description goes here.
            </div>
          </div>
        </div>

        {/* Optional footer / stats row */}
        <div className="grid grid-cols-4 gap-3 shrink-0">
          {['Stat 1', 'Stat 2', 'Stat 3', 'Stat 4'].map((stat) => (
            <div key={stat} className="glass rounded-xl p-3 border border-white/8 text-center">
              <div className="text-[9px] text-white/20 font-display tracking-wider uppercase">
                {stat}
              </div>
              <div className="text-lg text-white/50 font-display mt-1">--</div>
            </div>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}

/**
 * STYLING REFERENCE:
 *
 * ─── COLOR CLASSES ───
 * text-primary        → oklch(0.55 0.22 20) — crimson, use for accent text
 * text-teal           → hsl(var(--teal)) — labels, secondary info
 * text-blue-info      → oklch(0.7 0.15 240) — informational text
 * text-white/60       → white at 60% opacity
 * bg-white/5          → white background at 5% opacity (glass bg)
 * border-white/8      → white border at 8% opacity
 * border-primary/20   → crimson border at 20% opacity
 *
 * ─── GLASS EFFECTS ───
 * .glass              → Red-tinted glass morphism (main background)
 * .glass:hover        → Hover state (slightly brighter)
 * .glass-crimson      → Crimson-tinted glass (accents)
 * .glow-crimson       → Strong crimson glow (shadows)
 * .glow-crimson-sm    → Subtle crimson glow (hover)
 * .text-glow          → Text shadow with crimson glow
 * .text-glow-teal     → Text shadow with teal glow
 *
 * ─── TYPOGRAPHY ───
 * .font-display       → Orbitron font (headers, badges)
 * text-sm             → ~14px
 * text-xs             → ~12px
 * text-[9px]          → Exact size (use for labels)
 * tracking-wider      → Letter spacing (labels, badges)
 * tracking-[0.14em]   → Exact tracking (headers)
 *
 * ─── ANIMATIONS ───
 * .pulse-crimson      → Crimson pulse animation (1.5s)
 * .pulse-green        → Green pulse (status indicators)
 * .pulse-red          → Red pulse
 * .blink              → Blink animation (1s)
 *
 * ─── LAYOUT ───
 * grid grid-cols-3 gap-4      → 3-column grid, 16px gap
 * grid grid-cols-2 gap-3      → 2-column grid, 12px gap
 * flex items-center justify-between   → Horizontal flex with space-between
 * flex flex-col gap-2         → Vertical flex, 8px gap
 *
 * ─── BORDERS & RADIUS ───
 * rounded-lg          → 0.5rem
 * rounded-xl          → 0.75rem
 * border border-white/8  → 1px border
 *
 * ─── SPACING ───
 * p-3                 → 12px padding (card interiors)
 * p-4                 → 16px padding
 * px-3 py-1.5         → Horizontal 12px, vertical 6px (button)
 * gap-2               → 8px gap between items
 * gap-3               → 12px gap
 * gap-4               → 16px gap
 *
 * ─── TRUNCATION ─── 
 * truncate            → Single-line text truncation
 * line-clamp-2        → 2-line max
 * leading-relaxed     → 1.625 line height (body text)
 *
 * Always prefer semantic TailwindCSS classes over inline style={} objects.
 * Never use oklch() values directly — use CSS variable classes instead.
 */
