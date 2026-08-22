# Design QA

- Source visual truth: `/var/folders/mf/t9mxfbyx2dx1mg_l76vfxsch0000gn/T/codex-clipboard-d23243c7-4442-4289-8540-1e33289f9925.png`
- Implementation screenshot: `/tmp/hiro-order-mobile-390-after.png`
- Combined comparison: `/tmp/hiro-order-mobile-comparison.png`
- Viewport: 390 x 844 CSS px, device density 1
- Source pixels: 1012 x 990; page content was cropped to 948 x 936 and normalized to 390 px wide for comparison
- Implementation pixels: 390 x 844
- State: product page at the top of the page, empty cart

## Full-view comparison evidence

The supplied capture shows the mobile header consuming too much of the first screen before the category navigation. The revised browser capture moves the category navigation from 393 px to 311 px at the exact 390 px viewport, releasing 82 px (20.9%) without removing the awning, booth chip, brand copy, or character art. The first product heading is now visible higher in the initial viewport.

## Focused region comparison evidence

The combined comparison focuses on the entire header and category navigation because that is the only changed region. A separate detail crop was not needed: the title, booth chip, intro copy, character image, lower header edge, and navigation labels are all readable at this scale.

## Required fidelity surfaces

- Fonts and typography: existing families, weights, shadows, and hierarchy are unchanged. Only the mobile display-title size and intro size/line height were tightened; both remain legible and do not wrap unexpectedly.
- Spacing and layout rhythm: the mobile awning, header padding, content panel, brand spacing, booth chip, and character art were proportionally compressed. The 390 px and 620 px checks both report a 311 px header and no horizontal overflow.
- Colors and visual tokens: no color, border, shadow, or token changes.
- Image quality and asset fidelity: the existing `assets/papa-logo.png` is preserved and rendered at 120 px wide with no crop or substitution.
- Copy and content: all labels and product-page copy are unchanged, including the required `広` character.

## Findings

No actionable P0, P1, or P2 differences remain for the requested mobile-header-height correction.

## Comparison history

1. Earlier finding (P2): at 390 px the header measured 393 px, delaying category navigation and product discovery.
2. Fix: reduced only the max-620 px awning height, panel height/padding, brand spacing, title/intro sizing, booth chip, and character art scale.
3. Post-fix evidence: the same 390 x 844 browser viewport measures a 311 px header, `scrollWidth` equals 390 px, and browser console warnings/errors are empty. At 620 px, `scrollWidth` equals 620 px. At 1440 px, the desktop header remains 423.97 px and has no horizontal overflow.

## Implementation checklist

- [x] Compress mobile header without removing identity elements
- [x] Verify 390 px and 620 px responsive layouts
- [x] Verify desktop rules are unaffected
- [x] Check horizontal overflow and browser console
- [x] Run all logic tests

final result: passed
