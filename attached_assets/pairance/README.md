# Pairance — Brand Kit v1.1

**Better money, together.** Couples budgeting for shared goals and everyday clarity.

Open `pairance-brand-kit.html` in any browser. Outfit and Inter are embedded, so it
works with no network connection.

## What's here

```
pairance-brand-kit.html      Full guidelines: marks, construction, colour, type, UI, voice
logo/                        Vector marks (wordmark converted to outlines — no font needed)
logo/png/                    Raster exports at 2x
pattern/                     Guilloché engraving assets (rosette, border, security field)
tokens/pairance-tokens.css   CSS custom properties, drop into your :root
tokens/pairance-tokens.json  Same values for design tools and theme config
```

## Choosing a file

| File | Use it for |
|---|---|
| `pairance-logo-horizontal.svg` | Default. Headers, decks, email signatures |
| `pairance-logo-horizontal-reversed.svg` | On Midnight Navy or photography |
| `pairance-logo-stacked.svg` | Narrow columns, merch, app splash |
| `pairance-mark.svg` | Avatars, favicons, loading states |
| `pairance-mark-knockout.svg` | Over colour or imagery — heart is transparent |
| `pairance-logo-mono-navy.svg` / `-cream.svg` | Single ink: print, embroidery, fax |
| `pairance-app-icon.svg` | iOS, Android, PWA (512 and 1024 px PNGs included) |
| `pairance-favicon.svg` | Browser tab, 64 px |
| `pairance-mark-construction.svg` | Reference geometry, not for placement |

## The mark

Two whole circles overlapping. The intersection resolves to a third colour, and a heart
sits in the space neither circle owns.

Everything derives from one number, the circle radius *r*:

- Circle centres sit **0.52 r** either side of the axis
- The heart is **0.76 r** tall, centred in the overlap, never touching an edge
- Clear space is **0.5 r** on all sides — nothing crosses it
- Minimum size: **24 px** for the mark, **120 px** wide for the full lockup

Below 24 px the heart closes up. Below 120 px the wordmark's thin joins fill in — use the
mark alone rather than shrinking further.

## Colour

| Name | Hex | Role |
|---|---|---|
| Midnight Navy | `#182235` | Body text, headings, dark surfaces |
| Mint Leaf | `#69D3B0` | Primary buttons, on-track states, progress fill |
| Teal Current | `#2FA7A0` | The overlap. Charts, outlines, shared-item badges |
| Warm Coral | `#FF8C7A` | Over budget, due today. Under 5% of any screen |
| Soft Cream | `#F6F3EE` | App and page background |
| Slate Gray | `#6B7280` | Dividers, icon outlines, disabled controls |

### Accessibility — read this before building UI

Mint, teal and coral are **surface colours only**. On Soft Cream they measure 1.64:1,
2.65:1 and 2.04:1 — all well below the 4.5:1 minimum for body text. Slate Gray lands at
4.37:1, just short.

White text on a mint button is **1.82:1** and fails. Navy on mint is **8.75:1**. Text on
mint is always Midnight Navy.

When one of these colours has to *be* a word — a link, a label, an error — use its deep
shade. These are the only additions to the palette and each clears 4.5:1 on cream:

| Token | Hex | Contrast on cream | Use |
|---|---|---|---|
| `--pr-teal-deep` | `#1F6F6B` | 5.35:1 | Links, teal as text |
| `--pr-slate-deep` | `#5B6472` | 5.40:1 | Secondary body text |
| `--pr-coral-deep` | `#B4442F` | 4.98:1 | Error text on light |

## The money layer

The mark says *couples*. These three things say *money* — without a single dollar sign,
upward arrow, or coin illustration.

### 1. Engraving

Money has its own graphic tradition: guilloché, the engine-turned line work cut into
banknotes and share certificates. Every curve in `pattern/` is generated from **0.52** —
the same ratio that positions the two circles in the mark. Reduced, that's 13:25, which
is also the frequency relationship in the border braid. The identity and the security
pattern come from one number.

| Asset | Use |
|---|---|
| `pairance-rosette-*.svg` | Watermark behind a balance, statement headers, card backs. Never above 50% opacity |
| `pairance-border-*.svg` | Section rules, receipt edges, export and statement headers |
| `pairance-field-teal.svg` | Seamless 104 px tile. Empty states, sign-in, locked screens |

Patterns are always hairline and always subordinate. If someone notices the pattern before
the number, it's too strong.

### 2. Numerals

This is the cheapest and biggest lever. Money reads as money through figure treatment:

- **Currency symbol** drops to 58% and rises 0.46em
- **Cents** drop to 56% and rise 0.58em — the dollars stay the loudest thing in the number
- **Figures are always tabular**, so a column holds alignment as values change
- **Minus sign (−), never accounting brackets.** Brackets read as a spreadsheet, not a life
- **Colour never carries the sign on its own**

### 3. Ledger semantics

Every amount on screen carries exactly one of five meanings. No new hues — just fixed jobs
for colours you already have.

| Meaning | Fill | Text |
|---|---|---|
| Money in | `#69D3B0` mint | `#1F6F6B` |
| Money out | `#182235` navy | `#182235` |
| Shared | `#2FA7A0` teal | `#1F6F6B` |
| Pending | `#6B7280` slate | `#5B6472` |
| Over budget | `#FF8C7A` coral | `#B4442F` |

An amount never uses a colour outside this list.

## Type

**Outfit** sets anything with a number or a headline in it — its even geometry echoes the
mark. **Inter** carries the reading. Never the reverse. Money is always set in tabular
figures so columns hold still as values change.

| Role | Font | Size / line | Tracking |
|---|---|---|---|
| Display | Outfit 600 | 52 / 1.05 | −0.02em |
| H1 | Outfit 600 | 36 / 1.15 | −0.02em |
| H2 | Outfit 600 | 24 / 1.25 | −0.01em |
| H3 | Outfit 600 | 18 / 1.35 | — |
| Amount | Outfit 600 | 40, tabular | −0.02em |
| Body | Inter 400 | 16 / 1.6 | — |
| Small | Inter 400 | 14 / 1.5 | — |
| Label | Inter 600 | 12, uppercase | 0.09em |

The wordmark in every SVG is converted to outlines, so the logo renders correctly even
where Outfit isn't installed.

## Interface

Pill buttons, 20 px card corners, 4 px spacing base, soft two-layer shadows. One mint
button per screen — it marks the single thing you want someone to do. Icons are 24 px
grid, 1.7 stroke, round caps, outlined only.

## Voice

Two people share this screen and they may not agree about money. Pairance reports; it
never takes a side and never scolds.

- Say what happened, plainly — "Groceries went $180 over this month," not "Uh oh!"
- Never assign blame — "Two purchases aren't categorised yet," not "Sam forgot again"
- Empty screens invite action — "No goals yet. Add the first one you both want"
- Errors explain the fix — "Your bank ended the connection. Sign in again to resume syncing"
