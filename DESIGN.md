# DESIGN.md — Dark Romer Design Constitution (`Astro-Exoplanets`)

> **Design Read (`taste-design` v2):**
> *"Scientific astrophysical prioritization telemetry console (`Operate` mode) for Telescope Allocation Committees (TAC) across Chilean observatories and JWST campaigns, built on **Dark Romer (`Cinematic Precision`)** with obsidian layering, crisp hairlines, 6px semantic status dots, `Manrope + Inter + JetBrains Mono` typography, and interactive Apache ECharts."*

**Calibration Dials:**
- `DESIGN_VARIANCE`: 5 (Structured symmetry in KPI telemetry & comparison grids; asymmetric analytical tabs)
- `MOTION_INTENSITY`: 2 (Scientific containment: `< 200ms cubic-bezier(0.23, 1, 0.32, 1)` transitions; zero continuous decorative loops)
- `VISUAL_DENSITY`: 7 (High-signal operational console governed by a `4px / 8px` modular spacing scale)

---

## 1. Visual Theme & Atmosphere

- **Obsidian Layering:** Base canvas `#080809`, sidebar `#0E0E0F`, primary cards/charts `#101112`, elevated secondary bands `#151617`, hover surface `#191A1C`, delimited by crisp `1px` hairlines (`#1B1C1E` / `#232426`) and subtle top specular inner glow (`inset 0 1px 0 0 rgba(255, 255, 255, 0.06)`).
- **Monochromatic Status Discipline:** Operational source states communicate via a single **`6px` circular dot** (`#50D8E9` Live NASA API, `#FFB689` Local Plan B Snapshot, `#FFB4AB` Error) inside a `#101112` bar — never saturated full-width green/yellow/red banners.
- **Anti-Slop Guardrails:** Zero generic purple-pink gradients, zero nested card-in-card wrappers, zero `transition: all`, zero `height: 100vh` (use `min-height: 100dvh`).

---

## 2. Color Palette & Functional Roles

| Semantic Token | Hex | Functional Role |
| --- | --- | --- |
| `--exo-canvas` | `#080809` | Application base canvas |
| `--exo-sidebar` | `#0E0E0F` | Filter sidebar background |
| `--exo-surface-1` | `#101112` | KPI cards, chart panels, tables, status bar |
| `--exo-surface-2` | `#151617` | Question band, table headers, secondary buttons, segmented track |
| `--exo-surface-high` | `#191A1C` | Interactive hover surface |
| `--exo-border-subtle` | `#1B1C1E` | Hairline dividers & metric borders |
| `--exo-border-structural` | `#232426` | Panel & table structural borders |
| `--exo-border-muted` | `#2A2A2B` | Secondary separators & scrollbars |
| `--exo-border-focus` | `#5E6BFF` | `:focus-visible` & `:focus-within` 2px ring |
| `--exo-text-primary` | `#E5E2E3` | Headings, KPI values, primary tabular figures |
| `--exo-text-secondary` | `#C6C5D8` | Analytical prose (`TAC READING`), table text |
| `--exo-text-muted` | `#9A9DA3` | `11px` uppercase overlines, subtitles, axis labels |
| `--exo-accent` | `#5E6BFF` | Primary brand accent, active tab underline, form `accent-color` |
| `--exo-accent-hover` | `#7A85FF` | Secondary button hover & accent highlight |
| `--exo-cerulean` | `#50D8E9` | Transit series, JWST telemetry, Live API status dot |
| `--exo-teal` | `#00B1C2` | Chilean observability (`Dec <= +20 deg`, `airmass <= 2.0`), Habitable Zone |
| `--exo-highlight` | `#FFB689` | Radial Velocity, Plan B indicator, featured candidates |
| `--exo-amber` | `#E0731D` | Auxiliary thermal / threshold marker |
| `--exo-slate` | `#8F8FA1` | Background catalog context series |
| `--exo-danger` | `#FFB4AB` | Critical error dot & physical exclusion boundary |

---

## 3. Typography Rules

- **Headings & KPIs:** `'Manrope', 'Inter', system-ui, sans-serif`
- **Body & Controls:** `'Inter', system-ui, -apple-system, sans-serif`
- **Technical Labels, Badges & Tabular Data:** `'JetBrains Mono', ui-monospace, monospace`
- **Numeric Discipline:** `font-variant-numeric: tabular-nums` is mandatory across all KPIs, coordinates (`RA`, `Dec`), `ESI`, `TSM`, `airmass`, flux tables, and sensitivity matrices, using the typographic minus `\u2212`.

---

## 4. Component Stylings

- **Buttons:** `min-height: 44px`, `border-radius: 4px`, `touch-action: manipulation`, transitions restricted to `transform`, `background-color`, `border-color`, `color` (`150ms cubic-bezier(0.23, 1, 0.32, 1)`).
- **Tabs:** Single-row scrollable `[role="tablist"]` with `<button type="button" role="tab">`. Active state indicator uses `[aria-selected="true"]::after` with `border-block-end: 2px solid var(--exo-accent)`. Tab panels use `hidden="until-found"` with padding/borders placed on `.tab-panel-inner`.
- **Responsive Tables:** Wrapped in `<div tabIndex={0} role="region" aria-labelledby="..." className="table-wrapper">` with `container-type: inline-size`, sticky `thead`, and `@container (width < 600px)` card stacking via `--label-N` CSS variables.
- **Planet Inspector Modal:** Native `<dialog closedby="any">` invoked via `.showModal()`, `dialog:modal { overscroll-behavior: contain; }` and `dialog::backdrop { overflow: hidden; overscroll-behavior: contain; }`.
- **Forms:** Native `<input>` controls styled with `color-scheme: dark` and `accent-color: var(--exo-accent)` plus `@supports not (accent-color: var(--exo-accent))` fallback.

---

## 5. Layout, Depth & Responsive Behavior

- **Desktop (`>= 1024px`):** Persistent `312px` left sidebar (`#0E0E0F`) + main workspace (`max-width: 1440px`), 4-column KPI strip, dual ECharts grids.
- **Tablet (`640px - 1023px`):** Drawer/collapsible filter sidebar with `overscroll-behavior: contain`, 2-column KPI grid.
- **Mobile (`< 640px`):** `>= 16px` input font size (prevents iOS Safari auto-zoom), `>= 44px` hit targets, single-column stacked tables.
