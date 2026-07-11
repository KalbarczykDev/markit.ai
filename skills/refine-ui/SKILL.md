---
name: refine-ui
description: Design, implement, or review polished product interfaces using a systematic UI workflow derived from the project's licensed Refactoring UI materials. Use for frontend pages, components, dashboards, forms, onboarding, visual cleanup, design-system tokens, responsive behavior, or requests to make an interface look better or more professional.
---

# Refine UI

## Workflow

1. Inspect the product context, existing design language, framework, and reusable components before editing.
2. Name the single feature or user task being designed. Start with that feature rather than an application shell.
3. Define three to five personality adjectives. Express them consistently through type, color, radius, imagery, language, and density.
4. Sketch the smallest useful version in grayscale. Establish hierarchy with layout, spacing, weight, and contrast before adding decoration.
5. Define or reuse constrained tokens for spacing, sizing, type, color, radius, and elevation. Do not introduce arbitrary one-off values without a reason.
6. Implement the real interface early. Include loading, empty, error, disabled, focus, hover, active, overflow, and narrow-screen behavior relevant to the feature.
7. Review at realistic content lengths and viewport sizes using [review-checklist.md](references/review-checklist.md).
8. Fix the highest-impact hierarchy and usability problems first; add finishing details last.

## Decision rules

- Give primary, secondary, and tertiary information visibly different emphasis. Prefer weight and contrast over extreme font-size differences.
- Make spacing communicate relationships: space within a group must be smaller than space between groups.
- Start with generous whitespace, then reduce only where the interface feels disconnected or inefficient.
- Let content determine width. Do not stretch text, forms, cards, or controls merely to fill the viewport.
- Use a deliberate type scale, readable line lengths, and line height that decreases proportionally as type grows.
- Build complete color ramps and semantic roles. Never rely on color alone to convey state.
- Use fewer borders. Separate regions with spacing, background changes, or subtle shadows when they communicate structure better.
- Use elevation consistently: higher elements receive stronger shadows; combine a tight contact shadow with a softer ambient shadow when needed.
- Preserve image contrast with overlays or controlled placement. Treat user-provided images as unpredictable input.
- Improve weak defaults: deliberate list markers, quotes, links, checkboxes, empty states, and accent details make a larger difference than ornamental clutter.
- Do not invent unrequested functionality or imply controls that are not implemented.
- Preserve accessibility, semantic HTML, keyboard operation, visible focus, reduced-motion preferences, and sufficient contrast.

## Output expectations

- Reuse the project's component system and tokens when they exist.
- Explain the intended hierarchy and token choices briefly in the handoff.
- Verify behavior, not only appearance. Run available checks and inspect the rendered interface when tooling permits.
- For a review-only request, prioritize findings by user impact and point to exact files or components.

The detailed audit rubric is in [review-checklist.md](references/review-checklist.md). The licensed source inventory and optional project-local palette inputs are in [source-materials.md](references/source-materials.md); read that file only when choosing fonts, palettes, icons, or examples from the companion pack.
