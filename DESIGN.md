# Design System: High-End Competitive Technical Document
 
## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Arcane Interface."** 
 
Magic: The Gathering is a game of immense complexity, strategy, and ancient lore. This system rejects the "toy-like" aesthetics of casual gaming apps in favor of a high-fidelity, editorial tool feel. We treat the UI as a professional workstation for tactical analysis—think of a digital spellbook or a high-end financial terminal for a dark fantasy universe.
 
To break the "standard template" look, this system utilizes **intentional asymmetry** (e.g., heavy left-aligned typography contrasted with floating right-aligned glass modules) and **tonal depth**. We avoid rigid boxes, opting instead for overlapping layers that suggest a deep, three-dimensional workspace.
 
---
 
## 2. Colors & Surface Philosophy
 
### The Tonal Palette
The foundation of the system is built on deep obsidian tones, punctuated by high-chroma mystic accents.
*   **Primary (`#ecb2ff` / `#8e44ad`):** Mystic Purple. Used for progression, "mana" highlights, and high-level actions.
*   **Secondary (`#92ccff` / `#3398db`):** Electric Blue. Denotes tactical information, technical UI elements, and interactive states.
*   **Tertiary (`#efc209` / `#cea700`):** Subtle Gold. Reserved for "Legendary" status, winner states, and rare achievements.
 
### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders to define sections.
Boundaries must be created through background shifts. For example:
*   Main App Surface: `surface` (`#131313`)
*   Sidebar/Navigation: `surface-container-low` (`#1c1b1b`)
*   Nested Action Panels: `surface-container-high` (`#2a2a2a`)
 
### Surface Hierarchy & Glassmorphism
We treat the UI as physical layers of "Obsidian" and "Aether Glass."
*   **Nesting:** Instead of a flat grid, use the surface-container tiers (Lowest to Highest) to create a "nested" depth. An inner card should always be a tier higher than its parent container to create a natural, borderless lift.
*   **Glass & Gradient Rule:** Navigation and floating "Command" modals must use Glassmorphism. Utilize a semi-transparent `surface-container` with a `backdrop-filter: blur(20px)`. 
*   **Signature Textures:** For primary CTAs, use a 45-degree linear gradient transitioning from `primary` (`#ecb2ff`) to `primary_container` (`#8e44ad`). This adds a "soul" to the UI that flat colors lack.
 
---
 
## 3. Typography: Editorial Authority
The type system pairs the technical precision of **Space Grotesk** with the clean readability of **Manrope**.
 
*   **Display & Headlines (Space Grotesk):** These are your "Aggro" elements. High-contrast, bold, and modern. Use `display-lg` for win-screens or deck titles to command immediate attention.
*   **Titles & Body (Manrope):** These are your "Control" elements. Manrope provides a neutral, professional atmosphere for card descriptions, stats, and technical data.
*   **Labels (Manrope):** Used for micro-copy and metadata.
 
**Hierarchy Note:** Use wide tracking (letter-spacing) on `label-sm` in all-caps for a "technical readout" feel in data-heavy views.
 
---
 
## 4. Elevation & Depth: The Layering Principle
 
### Tonal Layering
Forget drop shadows for standard UI components. Depth is achieved by "stacking" tones:
1.  **Level 0 (Base):** `surface_container_lowest` (`#0e0e0e`) - The "Void."
2.  **Level 1 (Sections):** `surface` (`#131313`) - The "Stage."
3.  **Level 2 (Cards):** `surface_container` (`#201f1f`) - The "Content."
 
### Ambient Shadows
When an element must float (e.g., a card being "played" or a tooltip):
*   **Blur:** 24px - 40px.
*   **Opacity:** 6% - 10%.
*   **Tint:** Use a tinted version of `on_surface` (e.g., a dark purple-grey) rather than pure black to simulate realistic light absorption.
 
### The "Ghost Border"
If a border is required for accessibility (e.g., Input Fields), use the `outline_variant` at **15% opacity**. This creates a "Ghost Border" that defines the shape without breaking the seamless aesthetic.
 
---
 
## 5. Components
 
### Buttons
*   **Primary:** Linear gradient (`primary` to `primary_container`). `rounded-md` (0.375rem). White text (`on_primary`).
*   **Secondary:** Glass-style. No fill, Ghost Border (15% opacity), Electric Blue text (`secondary`).
*   **States:** On hover, the primary button should "glow"—add a soft shadow matching the button's color at 20% opacity.
 
### The "Commander" Card
A signature component for deck-building. Forbid the use of divider lines. Instead, use vertical white space (1.5rem) and a background shift from `surface_container` to `surface_container_high` for the card header.
 
### Inputs & Search
*   **Style:** Minimalist. No solid backgrounds; use `surface_container_lowest` with a bottom-only Ghost Border.
*   **Focus State:** The bottom border transforms into a 2px `secondary` (Electric Blue) line with a subtle outer glow.
 
### Tooltips (The "Oracle" Style)
*   **Background:** `surface_container_highest` with 80% opacity and 12px blur.
*   **Text:** `body-sm` in `on_surface`.
*   **Animation:** Scale-in from 95% with a soft ease-out.
 
---
 
## 6. Do’s and Don’ts
 
### Do:
*   **Do** use asymmetrical layouts. For example, a deck list that takes up 40% of the screen while the card preview takes up 60%.
*   **Do** use "Breathing Room." Competitive tools often clutter the screen; we differentiate by using generous margins (`1.5rem` to `2rem`) between major containers.
*   **Do** use the `tertiary` (Gold) sparingly. It should feel earned, used only for critical success states or high-rarity items.
 
### Don’t:
*   **Don’t** use 100% opaque borders. They make the UI look like a legacy "template."
*   **Don’t** use standard Material Design "Floating Action Buttons" (FABs). Instead, integrate actions into the Glassmorphism navigation bar.
*   **Don’t** use pure black (#000) for shadows. It creates a "dirty" look on deep grey backgrounds.
*   **Don’t** use dividers. If you feel the need to separate two pieces of content, increase the padding or shift the background tone by one tier.