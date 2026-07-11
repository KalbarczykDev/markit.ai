# UI review checklist

## Product and hierarchy

- Is the primary user task obvious within a few seconds?
- Is there one dominant action per region, with destructive and secondary actions appropriately subdued?
- Can labels be removed because the value or surrounding context already explains the content?
- Does visual importance match task importance rather than HTML heading level alone?

## Layout and spacing

- Does every repeated gap come from a small spacing scale?
- Are related items grouped more tightly than unrelated items?
- Are text blocks, forms, and cards limited to useful widths?
- Do alignments follow the content's natural geometry instead of a rigid grid?
- Do dense rows align text and icons optically, using baselines where appropriate?

## Typography

- Is there a limited, clearly differentiated type scale?
- Are normal and emphasized weights sufficient, without thin small text?
- Are paragraphs approximately 45–75 characters wide?
- Do large headings use tighter line height and body copy use more generous line height?
- Are uppercase labels short and given modest positive letter spacing?

## Color and state

- Are neutral, primary, and semantic color ramps defined rather than improvised per component?
- Are primary, secondary, and tertiary text colors distinct and readable?
- On colored surfaces, are lighter or more saturated variants used instead of muddy gray text?
- Does every status also have text, an icon, a shape, or another non-color cue?
- Are focus, hover, active, disabled, error, success, and selected states intentional?

## Depth, borders, and imagery

- Does elevation reflect a consistent light source and stacking order?
- Can a border be replaced by spacing, a background shift, or a subtle shadow?
- Do overlapping elements clearly communicate layers without obscuring content?
- Does text over imagery retain predictable contrast for every possible image?
- Are uploaded images cropped and constrained without assuming ideal dimensions?

## Content, resilience, and accessibility

- Are labels, actions, and empty states concrete and useful?
- Does the layout survive long names, translated copy, missing data, and large collections?
- Are semantic HTML, keyboard navigation, visible focus, target sizes, contrast, and reduced motion covered?
- Do loading and error states preserve context and offer a next step?
- Has the interface been checked at narrow, medium, and wide viewports with realistic data?
