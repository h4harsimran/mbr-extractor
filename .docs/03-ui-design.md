# 03 - UI & CSS Design System

The application uses an ad-hoc premium dark-mode CSS design system located in `frontend/src/index.css`.

## Core Philosophy

- **Zero dependencies**: No Tailwind, BootStrap, or Component libraries. Pure vanilla CSS.
- **Glassmorphism**: Extensive use of `backdrop-filter: blur(20px)` and semi-transparent RGBA backgrounds.
- **Gradients**: Text clips and background linear gradients utilizing an Indigo/Violet palette (`#6366f1` to `#a78bfa`).
- **Micro-interactions**: Hover lifts (`transform: translateY(-4px)`), smooth CSS transitions, and subtle pulse/shimmer animations for progress states.

## Key Components

### Card
Base structural element `.card`.
- Dark semi-transparent background (`rgba(17, 24, 39, 0.7)`).
- 1px inset glass border (`rgba(255, 255, 255, 0.08)`).
- Hover effect transitions the border color.

### Grid Progress (ExtractionProgress.tsx)
- Visualizes 100-page extractions cleanly.
- Uses `display: grid` with `auto-fill` and `minmax(44px, 1fr)`.
- Each page is a `.page-dot` that dynamically changes color based on `PageStatus`:
  - **Pending**: Grey border, transparent bg.
  - **Processing**: Indigo border, pulsing animation.
  - **Completed**: Green text, subtle green bg.
  - **Failed**: Red text, subtle red bg.

### Data Table (ResultsView.tsx)
- Used to preview the first 50 rows of data in the browser.
- Integrates a visual `confidence-bar` column: Green (>80%), Yellow (>50%), Red (<50%).
- Automatically truncates massive result sets to prevent DOM locking.

## Modifying the Theme

To change the theme colors (e.g., to match a specific corporate identity), adjust the custom properties in `:root` inside `index.css`:

```css
:root {
  --accent-primary: #818cf8; /* Adjust these values */
  --accent-secondary: #6366f1;
  ...
}
```
