# Apple Web Design Direction

## Overview

Apple's web presence is a masterclass in **reverent product photography framed by near-invisible UI**. Every page is a stack of edge-to-edge product "tiles" — alternating light and dark canvases, each centered on a hero headline, a one-line tagline, two tiny blue pill CTAs, and an impossibly crisp product render. Nothing competes with the product. Typography is confident but quiet; color is either pure white, an off-white parchment, or a near-black tile; interactive elements are a single, quiet blue.

Density is unusually low even by contemporary SaaS standards. Each tile occupies roughly one viewport, and there is no decorative chrome — no borders, no gradients, no decorative frames, no shadows on headlines. Elevation appears only when a product image rests on a surface (a single soft `rgba(0, 0, 0, 0.22) 3px 5px 30px` drop for visual weight). The result is a catalog that feels more like a museum gallery: the wall disappears and the artifact takes over.

Store and shop surfaces retain the same chassis but switch modes. The product configurator introduces a tight grid of white utility cards at `{rounded.lg}` (18px) radius with a thin border, paired with a persistent thin sub-nav strip. Across all surfaces the typographic system, spacing rhythm, and the single blue accent are consistent — this is one design language expressed at different volumes.

## MUMU Mobile Product Contract

MUMU is a mobile-only product. Every product view is designed and tested within a canvas no wider than 430px; there is no desktop-specific page composition. On a real phone the canvas fills `100vw × 100dvh`. At browser widths of 480px or more, the same mobile canvas is centered with a 16px outer inset, a 28px frame radius, and a neutral surrounding field. The wide viewport must never change content density, type scale, navigation, or component arrangement.

- App canvas: `min(100vw, 430px)` with a maximum width of 430px.
- Shell rows: 44px header, internally scrolling content, and 70px bottom navigation plus the safe-area inset.
- Responsive logic: app-container queries only; 419px and below is the sole compact-phone correction range.
- Primary layouts: one content column, two-column chapter index, one-column memory view, and the compact chapter detail.
- Wide screens: presentation frame only. Do not introduce desktop navigation, extra columns, wider cards, or browser-viewport-scaled typography.
- Overlays: players, sheets, dialogs, toasts, and backdrops remain clipped to the app canvas.

### Chapter hierarchy

- The main chapter index and Home preview show root chapters only.
- A chapter may contain child chapters at any depth; its detail view shows direct children as compact hairline rows.
- Breadcrumbs expose the full root-to-current path without widening the mobile canvas.
- Tracks, tags, and memories belong to the exact chapter where they were recorded. Parent playlists do not silently merge child tracks.
- Deleting a parent removes only its direct memories and promotes its direct children one level so nested archives are not lost.
- The child-chapter creation sheet keeps its final actions visible above the 70px bottom navigation.

**Key Characteristics:**
- Photography-first presentation; UI recedes so the product can speak.
- Alternating full-bleed tile sections: white/parchment ↔ near-black, with the color change itself acting as the section divider.
- Single blue accent (`{colors.primary}` — #0066cc) carries every interactive element. No second brand color exists.
- Two button grammars: tiny blue pill CTAs (`{rounded.pill}`) and compact utility rects (`{rounded.sm}`).
- SF Pro Display + SF Pro Text — negative letter-spacing at display sizes for the signature "Apple tight" headline feel.
- Whisper-soft elevation used only when a product image needs to breathe — exactly one drop-shadow in the entire system.
- Tight two-row nav: slim `{component.global-nav}` + product-specific `{component.sub-nav-frosted}` with persistent right-aligned primary CTA.
- Section rhythm: light hero → dark product tile → light utility tile → dark tile → parchment footer.

## Colors

### Brand & Accent
- **Action Blue** (`{colors.primary}` — #0066cc): The single brand-level interactive color. All text links, blue pill CTAs, and the focus ring root.
- **Focus Blue** (`{colors.primary-focus}` — #0071e3): Reserved for keyboard focus rings (`outline: 2px solid`).
- **Sky Link Blue** (`{colors.primary-on-dark}` — #2997ff): Used only for links on dark surfaces.

### Surface
- **Pure White** (`{colors.canvas}` — #ffffff): Dominant canvas, content, utility cards, and configurator grids.
- **Parchment** (`{colors.canvas-parchment}` — #f5f5f7): Alternating light tiles, footer, and utility-section canvas.
- **Pearl Button** (`{colors.surface-pearl}` — #fafafc): Secondary ghost-button fill.
- **Near-Black Tile 1** (`{colors.surface-tile-1}` — #272729): Primary dark-tile surface.
- **Near-Black Tile 2** (`{colors.surface-tile-2}` — #2a2a2c): Micro-step lighter dark surface.
- **Near-Black Tile 3** (`{colors.surface-tile-3}` — #252527): Bottom-stack and embedded-player surface.
- **Pure Black** (`{colors.surface-black}` — #000000): Global navigation and true-void media surfaces only.
- **Translucent Chip Gray** (`{colors.surface-chip-translucent}` — #d2d2d7): Circular control chips over imagery, typically `rgba(210, 210, 215, 0.64)`.

### Text
- **Near-Black Ink** (`{colors.ink}` — #1d1d1f): All headlines and body copy on light surfaces.
- **Body** (`{colors.body}` — #1d1d1f): Default light-surface text.
- **Body On Dark** (`{colors.body-on-dark}` — #ffffff): Dark tiles and global nav.
- **Body Muted** (`{colors.body-muted}` — #cccccc): Secondary copy on dark tiles.
- **Ink Muted 80** (`{colors.ink-muted-80}` — #333333): Softer copy on pearl surfaces.
- **Ink Muted 48** (`{colors.ink-muted-48}` — #6e6e73): Secondary copy, disabled text, and legal fine-print with readable contrast on white and parchment surfaces.

### Hairlines & Borders
- **Divider Soft** (`{colors.divider-soft}` — #f0f0f0): Secondary-button soft ring, often `rgba(0, 0, 0, 0.04)`.
- **Hairline** (`{colors.hairline}` — #e0e0e0): 1px utility-card and configurator border.

### Brand Gradient

**No decorative gradients.** Atmospheric depth belongs to imagery, never CSS overlays.

## Typography

### Font Family
- **Display**: `SF Pro Display, system-ui, -apple-system, BlinkMacSystemFont, sans-serif` — headings at 19px and above.
- **Body / UI**: `SF Pro Text, system-ui, -apple-system, BlinkMacSystemFont, sans-serif` — body, captions, buttons, and links.
- **OpenType features**: numeric UI may use `font-variant-numeric: tabular-nums`; display sizes rely on tight tracking.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---:|---:|---:|---:|---|
| `{typography.hero-display}` | 56px | 600 | 1.07 | -0.28px | Hero headline |
| `{typography.display-lg}` | 40px | 600 | 1.10 | 0 | Tile headlines |
| `{typography.display-md}` | 34px | 600 | 1.47 | -0.374px | Section heads |
| `{typography.lead}` | 28px | 400 | 1.14 | 0.196px | Product-tile subcopy |
| `{typography.lead-airy}` | 24px | 300 | 1.5 | 0 | Editorial lead paragraphs |
| `{typography.tagline}` | 21px | 600 | 1.19 | 0.231px | Tagline and sub-nav category |
| `{typography.body-strong}` | 17px | 600 | 1.24 | -0.374px | Inline strong emphasis |
| `{typography.body}` | 17px | 400 | 1.47 | -0.374px | Default paragraph |
| `{typography.dense-link}` | 17px | 400 | 2.41 | 0 | Footer/utility link stacks |
| `{typography.caption}` | 14px | 400 | 1.43 | -0.224px | Secondary captions and buttons |
| `{typography.caption-strong}` | 14px | 600 | 1.29 | -0.224px | Emphasized captions |
| `{typography.button-large}` | 18px | 300 | 1.0 | 0 | Large store CTAs |
| `{typography.button-utility}` | 14px | 400 | 1.29 | -0.224px | Utility/nav controls |
| `{typography.fine-print}` | 12px | 400 | 1.0 | -0.12px | Fine-print |
| `{typography.micro-legal}` | 10px | 400 | 1.3 | -0.08px | Micro legal disclaimers |
| `{typography.nav-link}` | 12px | 400 | 1.0 | -0.12px | Global-nav links |

### Principles
- **Negative letter-spacing at display sizes.** Headlines at 17px and up tighten from `-0.12px` to `-0.374px`.
- **Body copy at 17px, not 16px.** The extra pixel creates a reading-first pace.
- **Weight 300 is real and rare.** Reserve it for airy 24px leads and rare 18px hero CTAs.
- **Weight 600, not 700, for headlines.** Use 700 sparingly.
- **Context-specific line-height.** Display 1.07–1.19, body 1.47, dense link stacks 2.41.
- **Weight 500 is absent.** The ladder is 300 / 400 / 600 / 700.

### Note on Font Substitutes

Use the system stack first so macOS/iOS resolve to SF Pro. On non-Apple platforms use Inter as the nearest open substitute. With Inter, apply `font-feature-settings: "ss03"`, tighten display tracking by `-0.01em`, and reduce body line-height from 1.47 to approximately 1.44.

## Layout

### Spacing System
- **Base unit:** 8px. Sub-base values 2, 4, 5, 6, and 7 are for tight typographic adjustments.
- **Tokens:** `{spacing.xxs}` 4px · `{spacing.xs}` 8px · `{spacing.sm}` 12px · `{spacing.md}` 17px · `{spacing.lg}` 24px · `{spacing.xl}` 32px · `{spacing.xxl}` 48px · `{spacing.section}` 80px.
- **Section vertical padding:** 80px inside a product tile; tiles stack edge-to-edge with no gap.
- **Card padding:** 24px inside utility cards.
- **Button padding:** 8–11px vertical, 15–22px horizontal.

### Grid & Container
- Product canvas max width: 430px in every environment.
- Content gutter: 16–22px, derived from the app container rather than the browser viewport.
- Chapter index: two columns at every supported width.
- Memory and editorial reading surfaces: one column.
- No desktop grid, desktop breakpoint, or viewport-width type scaling.

### Whitespace Philosophy

Whitespace is the product's pedestal. Full tiles begin with at least 64px above the headline and 48–64px below. Product imagery keeps at least 40px from surrounding content. Footer information may be denser but must remain scannable.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| Flat | No shadow, no border | Full-bleed tiles, global nav, footer, body sections |
| Soft hairline | 1px `rgba(0, 0, 0, 0.08)` border | Utility cards and frosted sub-nav separator |
| Backdrop blur | Parchment 80% with `backdrop-filter` | Sub-nav and floating sticky bars |
| Product shadow | `rgba(0, 0, 0, 0.22) 3px 5px 30px 0` | Product imagery only |

**Shadow philosophy.** Use exactly one drop-shadow and apply it only to photographic product imagery. Never shadow cards, buttons, text, or navigation.

### Decorative Depth
- Atmosphere comes from imagery, not gradients.
- Alternating tile surfaces create hierarchy without borders.
- Backdrop blur is functional elevation for sticky bars.

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---:|---|
| `{rounded.none}` | 0px | Full-bleed product tiles |
| `{rounded.xs}` | 5px | Rare subtle inline chips |
| `{rounded.sm}` | 8px | Compact utility buttons and inline imagery |
| `{rounded.md}` | 11px | Pearl button capsules |
| `{rounded.lg}` | 18px | Store utility cards and accessories cards |
| `{rounded.pill}` | 9999px | Primary CTAs, option chips, search input |
| `{rounded.full}` | 9999px / 50% | Circular controls over imagery |

### Photography Geometry
- Hero imagery is full-bleed and rectangular.
- Product renders use transparent PNG/WebP when available and may receive the single product shadow.
- Utility-card artwork is square or 4:3, centered with 20–40px internal padding.
- Hero imagery is never rounded; inline utility imagery may use 8px or 18px.
- Lazy-load below-the-fold responsive images; load above-the-fold art eagerly.

## Components

### Top Navigation

**`global-nav`** — Persistent ultra-thin black nav held in the first row of the mobile app frame. Background `{colors.surface-black}`, height 44px, white 12px/400 text with `-0.12px` tracking. Retain a compact leading/back action, left-aligned product identity, and right utility icons at every browser width.

**`sub-nav-frosted`** — Surface-specific sticky strip below the global nav. Parchment at 80% opacity with `saturate(180%) blur(20px)`, height 52px, thin separator. Left: category name at 21px/600. Right: utility links ending in a persistent primary CTA.

### Buttons

**`button-primary`** — Action Blue `#0066cc`, white 17px/400 text, full pill, 11px × 22px padding. Active state `transform: scale(0.95)`. Focus state 2px Focus Blue outline.

**`button-secondary-pill`** — Transparent fill, Action Blue text and 1px blue border, full pill, 11px × 22px.

**`button-dark-utility`** — Near-black fill, white 14px/400 text, 8px radius, 8px × 15px padding, press scale 0.95.

**`button-pearl-capsule`** — Pearl fill, muted near-black 14px text, soft ring, 11px radius, 8px × 14px padding.

**`button-store-hero`** — Large Action Blue pill with 18px/300 type and 14px × 28px padding. Use sparingly.

**`button-icon-circular`** — 44 × 44px, translucent chip gray, near-black icon, fully circular. Used for carousel, close, and media controls.

**`text-link`** — Action Blue on light surfaces. Underline only when needed for text-flow clarity.

**`text-link-on-dark`** — Sky Link Blue on dark tiles only.

### Cards & Containers

**`product-tile-light`** — Edge-to-edge white tile, no radius, no border, 80px vertical padding. Centered display headline, lead line, pill CTAs, and product imagery.

**`product-tile-parchment`** — Same structure on Parchment.

**`product-tile-dark`** — Edge-to-edge Near-Black Tile 1, white text, no radius, 80px vertical padding, Sky Link Blue links.

**`product-tile-dark-2`** — Near-Black Tile 2 variant for adjacent dark sections.

**`product-tile-dark-3`** — Near-Black Tile 3 variant for lower-stack and embedded-player sections.

**`store-utility-card`** — White surface, 1px Hairline border, 18px radius, 24px padding. Product artwork above, 17px/600 title, 17px/400 supporting copy, Action Blue link. No card shadow.

**`configurator-option-chip`** — White pill cell, near-black 14px text, 12px × 16px padding, small thumbnail plus label/value.

**`configurator-option-chip-selected`** — Same geometry with 2px Focus Blue border.

**`environment-quote-card`** — Dark photographic canvas fallback, centered white 40px/600 headline, single primary CTA, 80px padding.

**`floating-sticky-bar`** — Parchment 80% with backdrop blur, 64px height, 12px × 32px padding. Running summary at left, primary CTA at right.

### Inputs & Forms

**`search-input`** — White fill, 17px near-black text, 1px `rgba(0, 0, 0, 0.08)` border, full pill, 12px × 20px padding, 44px minimum height, 14px muted leading search icon.

Other form inputs use white fill, a single Hairline border, 12–18px radius according to size, 17px body type, and Focus Blue outline. Error styling should use copy and focus treatment rather than introducing a second decorative accent.

### Footer

**`footer`** — Parchment background, muted near-black text. Link columns use 17px/400 with relaxed leading; headings use 14px/600. Legal row uses 12px muted text. Vertical padding 64px.

## Do's and Don'ts

### Do
- Use Action Blue `#0066cc` for every interactive element and no competing accent.
- Set display headlines in SF Pro Display/system 600 with negative letter-spacing.
- Run body copy at 17px/400/1.47.
- Alternate light/parchment and dark tiles; the color change is the divider.
- Reserve pill geometry for primary actions, configurator chips, and search.
- Apply the single product shadow only to product or album photography.
- Use `transform: scale(0.95)` for active button states.
- Keep the global nav pure black.
- Preserve a minimum 44 × 44px touch target.

### Don't
- Don't introduce a second accent color.
- Don't add shadows to cards, buttons, navigation, or text.
- Don't use decorative gradients.
- Don't use font-weight 500.
- Don't round full-bleed tiles.
- Don't tighten body line-height below 1.47.
- Don't mix arbitrary radii; use 8, 11, 18, or pill/full.
- Don't use Sky Link Blue on light surfaces.
- Don't use borders as universal separators; use space and surface alternation first.

## Responsive Behavior

### Supported Canvas Ranges

| Range | Product behavior |
|---|---|
| ≤ 419px app canvas | Apply only compact-phone corrections for long text, controls, and spacing. |
| 420–430px app canvas | Use the default mobile composition and type scale. |
| ≥ 480px browser viewport | Center the unchanged 430px app canvas inside the neutral device stage. |

The browser viewport is not a product breakpoint. Layout decisions use the app container, and content never expands beyond 430px.

### Touch Targets
- Minimum 44 × 44px.
- Primary pills naturally land at approximately 44px height.
- Circular icon controls are exactly 44 × 44px.
- Navigation and utility actions retain the same target size at every browser width.

### Collapsing Strategy
- Global navigation always uses the compact mobile brand/back and utility treatment.
- Chapter indexes remain two columns; memory, search, settings, and editorial reading views remain one column.
- Long titles, tag groups, and actions wrap or stack inside the canvas instead of triggering a wider composition.
- Only the 419px-and-below container query may reduce type, gaps, or control density.
- Overlays and fixed controls are positioned relative to the app frame, never the browser viewport.

### Image Behavior
- Use responsive `srcset` and breakpoint-matched crops where source assets allow.
- Hero photography may use mobile-specific art direction.
- Product/album renders maintain 1:1 or 4:3 aspect ratios; only scale changes.
- Lazy-load by default and eagerly load only the above-fold hero.

## Iteration Guide

1. Focus on one component at a time and reference its component key directly.
2. Keep active/focus variants as explicit component variants.
3. Use token references everywhere; do not inline hex values outside the token declaration block.
4. Document and implement Default, Active/Pressed, Focus, Disabled, and meaningful Selected states; avoid ornamental hover-only behavior.
5. Display headlines stay SF Pro Display/system 600 with negative tracking. Body stays SF Pro Text/system 400 at 17px.
6. The single drop-shadow is reserved for product or album photography only.
7. When emphasis is unclear, alternate the surface before adding chrome.
8. For MUMU, album artwork is the product photography. Let it carry visual weight while interface chrome recedes.

## Known Gaps

- Detailed form-validation/error colors were not surfaced; use accessible copy, Action Blue focus, and semantic system messaging without inventing a decorative accent.
- Embedded player interiors are platform-like utility surfaces; keep them black/near-black and minimal.
- Dark-mode variants for every utility card are not defined; the application remains daytime/light-dominant.
- Atmospheric photography is content, not a token. MUMU should use actual album artwork and the supplied LP asset instead of decorative CSS substitutes.
- Backdrop blur may vary by platform; `saturate(180%) blur(20px)` is the baseline.
