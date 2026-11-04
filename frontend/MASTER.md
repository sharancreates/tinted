# Tinted design system: frosted glass, coloured by skin

Single source of truth for the visual layer. Every colour, size, radius, shadow
and duration in the app comes from the tokens below, defined in
`app/globals.css` under `@theme`. Approved preview:
https://claude.ai/artifact/MEc21gvrHPBj2781ELQASb

## Theses (validated 2026-11-03)

**Visual.** A light-only frosted interface on a misty grey ground that warms to
peach and lavender at the bottom edges. Translucent white cards (55% white, 24px
blur, a 1px white inner edge, soft wide shadows) at a 28px radius sit inside one
large app window with a sidebar, content and a "your tone" panel. Art tiles are
blurred auras mixed from the ten Monk skin-tone values and soft pastels. A glossy
orb is both the logo and, on results, the measured tone. One coral accent marks
active states and icons; text is warm ink. Superseded on 2026-11-04 by the
warm editorial tokens below (cream, coral #D4765C, Playfair Display headings
over DM Sans, category pastels, 16 to 20px card radii); layouts follow later. Airy 8px spacing, 24 to 32px card padding.
Nav, tabs, inputs and buttons are fully rounded pills. Shade chips and product
photos always sit on solid white, never glass. Replaces the cream editorial look.

**Interaction.** Calm, medium timing on one curve, cubic-bezier(0.22, 1, 0.36, 1).
Hovers 220ms: cards lift 2px with a deeper shadow, the arrow button fills coral,
no scaling. Content enters once on load: 12px fade-up over 360ms, 40ms stagger.
No scroll-triggered reveals, no parallax. When a result arrives the orb settles
once (blurred, 92% → sharp, 100%) over 360ms and stops. Forbidden: bounce or
elastic springs, loops that never stop, neon glow, gradient text. Reduced motion:
every animation becomes a 120ms opacity fade.

**Allowed patterns:** frosted glass panels, blurred aura blobs built from the
Monk palette, the glossy orb, a faint dotted texture in the tone panel,
uppercase section labels.

## Colour

Warm editorial tokens (2026-11-04). Token names are shared with the frosted
glass system so components did not need renaming. Page layouts and the glass
utilities are unchanged for now; only the values moved.

| Token | Value | Use | Contrast |
|---|---|---|---|
| `bg` | `#FAF6F1` | cream paper (body adds a soft peach/lavender wash) | |
| `mist-peach` | `#F6E4D8` | ground wash, bottom left | |
| `mist-lavender` | `#ECE5F3` | ground wash, bottom right | |
| `surface` | `rgba(255,253,250,.6)` | cards | |
| `raised` | `rgba(255,253,250,.82)` | active pills, inputs, nested cards | |
| `swatch-ground` | `#FFFFFF` | anything whose colour is judged | |
| `text` | `#2B2420` | warm ink | 14.2 on cream |
| `text-soft` | `#5E544C` | secondary text | 6.9 on cream |
| `text-muted` | `#6B6058` | captions, meta | 5.2 on cream |
| `accent` | `#A64B2C` | coral text, coral buttons | 5.3 on cream, white on it 5.7 |
| `accent-vivid` | `#D4765C` | the brand coral: icons, active marks, large fills | 2.98 on cream: never small text |
| `accent-hover` | `#8F3F24` | pressed coral | |
| `accent-dim` | `rgba(212,118,92,.14)` | tinted chips | |
| `line` | `rgba(255,255,255,.85)` | card inner edge | |
| `line-strong` | `rgba(94,84,76,.18)` | dividers | |
| `danger` | `#B3261E` | errors | |
| `success` | `#1F6B4A` | confirmations | |

### Category pastels

One colour per kind of thing, so a card says what it is before it is read.
Use the ground as the card fill, the mid for icons, dots and borders, and the
ink for coloured text on the ground. Body text (`text`) is 12:1 or better on
every ground.

| Family | Ground | Mid | Ink (on ground) |
|---|---|---|---|
| `lavender` | `#E9E3F5` | `#B9A8E0` | `#5B4A8A` (6.0) |
| `sage` | `#E3EDE2` | `#9DBF9A` | `#3F6346` (5.7) |
| `peach` | `#FBE4D6` | `#F2B394` | `#8A4A2B` (5.6) |
| `sky` | `#DFEBF5` | `#9CC3E3` | `#2F5A7D` (6.0) |

Utilities follow: `bg-sage`, `border-sage-mid`, `text-sage-ink`, and so on.
Pastels mark category only. They never stand in for status (success, warning,
danger) and never carry data in charts.

## Type

Headings: Playfair Display (Google, variable, via `next/font`), fallback
`Georgia, serif`, as `--font-display`. `h1` to `h4` use it by default.
Body and UI: DM Sans (Google, variable), fallback `"Helvetica Neue", system-ui,
sans-serif`, as `--font-sans`.

| Token | Size | Weight | Use |
|---|---|---|---|
| `text-hero` | clamp(2.5rem, 5vw, 3.5rem) | 600, -0.015em | one page title per screen |
| `text-display` | 1.75rem | 600, -0.01em | section titles |
| `text-title` | 1.375rem | 500 | tile and card titles |
| `text-heading` | 1.125rem | 600 | sub-sections |
| `text-body` | 0.9375rem | 400 | running text |
| `text-small` | 0.8125rem | 400 | meta, captions |
| `text-label` | 0.6875rem | 500, caps, 0.12em | section labels |

## Space, radius, elevation

- Spacing: 8px base. 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64. Card gap 24, card padding 24 to 32, section gap 48 to 64.
- Radius: `sm` 12px, `tile` 16px, `card` 20px, `window` 28px, `pill` 999px. Tiles nest inside cards, so their corners stay concentric.
- Shadows: `card` (rest) `0 1px 2px rgba(70,45,30,.06), 0 8px 24px rgba(70,45,30,.06)`; `lift` (hover) `0 2px 4px rgba(70,45,30,.06), 0 18px 48px rgba(70,45,30,.10)`. Warm, never glow.

## Motion

| Token | Value | Use |
|---|---|---|
| `--ease-out-soft` | cubic-bezier(0.22, 1, 0.36, 1) | every transition |
| `--duration-fast` | 220ms | hover, press, colour changes |
| `--duration-base` | 360ms | entrance, orb settle |
| `--duration-reduced` | 120ms | reduced-motion fade |
| stagger | 40ms | siblings on first load only |

Framer Motion variants live in `lib/motion.ts`.

## Components

- **Glass card** (`.glass`, `Card`): `surface` fill, `backdrop-filter: blur(24px) saturate(140%)`, 1px `line` border, `card` shadow, inset top highlight, `card` radius.
- **Aura tile** (`Aura`): blurred radial blobs from Monk tones + pastels, white fade at the bottom for the label, 4px white border, `tile` radius.
- **Orb** (`Orb`): radial-gradient sphere with highlight and a shadow in its own tone. Takes `tone` (hex).
- **Button**: pill. `primary` ink / white, `secondary` raised glass, `ghost` transparent, `danger` outlined. Five states: default, hover (lift 1px + `lift` shadow), focus (2px `accent` ring, 3px offset), active (no lift), disabled (40% opacity).
- **Pill tabs**: transparent with white edge; selected is `raised` + `card` shadow.
- **App shell**: desktop, one `window` glass frame with a sticky sidebar in three groups: Discover (Home, Shade match, Skincare quiz), My collection (Vanity, Routine builder, Looks), Account (Profile, sign in or out). Below 1024px the frame drops away, a slim top bar holds the brand and the account avatar (links to Profile), and the five main destinations move to a bottom pill tab bar.
- **Right panel**: the column beside the main content. On the shelf it shows the tapped product (details, status, replenishment flag, cheaper dupes) and a summary before anything is picked. Below 1024px it becomes a bottom sheet.
- **Data views**: product grids use solid white cards on the mist ground, never aura tiles. Auras are for art and empty states; anything whose image or colour is judged sits on white.
