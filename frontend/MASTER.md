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
active states and icons; text is near-black ink and a muted plum grey. Poppins
throughout: 600 at 48 to 56px for page titles against 15px body, because its
round geometric letters echo the orb. Airy 8px spacing, 24 to 32px card padding.
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

Token names are kept from the previous system so components did not need
renaming; values are new.

| Token | Value | Use | Contrast (worst case) |
|---|---|---|---|
| `bg` | `#EEECEB` | mist ground (body adds the peach/lavender wash) | |
| `mist-peach` | `#F2DDD3` | ground wash, bottom left | |
| `mist-lavender` | `#DED2F1` | ground wash, bottom right | |
| `surface` | `rgba(255,255,255,.55)` | glass cards | |
| `raised` | `rgba(255,255,255,.72)` | active pills, inputs, nested glass | |
| `swatch-ground` | `#FFFFFF` | anything whose colour is judged | |
| `text` | `#211D26` | ink | 11.5 on lavender ground |
| `text-soft` | `#48414F` | secondary text | 7.9 on lavender ground |
| `text-muted` | `#625B6B` | captions, meta | 4.52 on lavender ground, ≥ 5.6 on glass |
| `accent` | `#B4431E` | coral text and small fills | 4.77 on glass, white on it 5.58 |
| `accent-vivid` | `#E2603A` | icons, active marks, large fills only | 3.0 on glass: never small text |
| `accent-hover` | `#96361A` | pressed coral | |
| `accent-dim` | `rgba(226,96,58,.12)` | tinted chips | |
| `line` | `rgba(255,255,255,.85)` | glass inner edge | |
| `line-strong` | `rgba(98,91,107,.18)` | dividers inside glass | |
| `danger` | `#B3261E` | errors | 5.6 on glass |
| `success` | `#1F6B4A` | confirmations | 6.0 on glass |

Primary buttons are ink (`text`) with white labels: 16.6:1.

## Type

Poppins (Google, via `next/font`), weights 400 / 500 / 600 / 700, fallback
`"Avenir Next", "Segoe UI", system-ui, sans-serif`. Both `--font-sans` and
`--font-display` resolve to it.

| Token | Size | Weight | Use |
|---|---|---|---|
| `text-hero` | clamp(2.5rem, 5vw, 3.5rem) | 600, -0.03em | one page title per screen |
| `text-display` | 1.75rem | 600, -0.02em | section titles |
| `text-title` | 1.375rem | 500 | tile and card titles |
| `text-heading` | 1.125rem | 600 | sub-sections |
| `text-body` | 0.9375rem | 400 | running text |
| `text-small` | 0.8125rem | 400 | meta, captions |
| `text-label` | 0.6875rem | 500, caps, 0.12em | section labels |

## Space, radius, elevation

- Spacing: 8px base. 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64. Card gap 24, card padding 24 to 32, section gap 48 to 64.
- Radius: `sm` 14px, `tile` 24px, `card` 28px, `window` 36px, `pill` 999px.
- Shadows: `card` (rest) `0 1px 2px rgba(60,40,70,.06), 0 8px 24px rgba(60,40,70,.06)`; `lift` (hover) `0 2px 4px rgba(60,40,70,.06), 0 18px 48px rgba(60,40,70,.10)`. No glow shadows.

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
