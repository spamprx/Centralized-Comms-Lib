# CommsLib Web UI — Design System & Redesign Notes

This document describes the UI-only redesign of `apps/web`. **No API contracts, services, or backend behavior were changed** as part of this work.

## 1. Overview of design changes

- **Central design tokens** in `src/styles/index.css` using Tailwind CSS v4 `@theme` (colors, radii, shadows, spacing, font).
- **Typography**: DM Sans (Google Fonts) as the primary UI font, loaded from `index.html`.
- **Reusable primitives** under `src/components/ui/`: `PageShell`, `PageHeader`, `Surface`, `Button`, shared `formStyles`, and the existing `Slot` placeholder (updated to match tokens).
- **App shell**: Authenticated layout uses a **desktop icon rail** (`md+`) and a **mobile floating menu** with full-height drawer, Escape-to-close, and backdrop. Main content uses responsive padding; protected routes show a **loading state** while auth initializes.
- **Page consistency**: Dashboard, library, analytics, profile, and my-content layouts use `PageShell` + `PageHeader` for alignment, hierarchy, and spacing. Dashboard **removed the duplicate faux sidebar** so navigation is single-sourced from the global sidebar.
- **Admin**: Panel uses the same background and border tokens; sidebar becomes a **horizontal scroll strip on small screens** and a fixed column on `md+`.
- **Full-app token pass**: Remaining screens and widgets (analytics charts, library filters/pagination, admin tables/modals, templates list/detail, editor/review/preview/version-history/chrome, chat, assets, AI tutor, modals) were migrated from ad hoc `gray-*`, `white/*`, and hex text colors to the **`app-*` utilities** so the whole product reads as one system. Light-theme template stubs (e.g. gray-900 on white) were restyled for the dark shell.
- **Atmosphere & depth (later pass)**: Authenticated `main` uses **`app-main-canvas`** (fixed grid + soft violet/teal mesh). **`Surface`** defaults add **backdrop blur** and translucent fills; variant **`glass`** is used for elevated panels (e.g. auth card). **Sidebar** is wider (`w-16`), glassy, with a **brand mark**, glow on active items, and a **gradient tick** for selection. **Landing** adds a masked hero grid, **stats strip**, and asymmetric feature cards. **Auth** is a **split layout** (story + perks on large screens, form in a glass card). **Dashboard** uses a **2+1 bento** (quick actions span two columns, activity in the third). **Library cards** are **link-wrapped** with hover shimmer, depth, and an “Open” affordance.

## 2. Design system (colors, fonts, spacing)

| Token / utility | Role |
|-----------------|------|
| `bg-app-bg`, `bg-app-bg-subtle` | Page and chrome backgrounds |
| `bg-app-surface`, `bg-app-elevated`, `border-app-border` | Cards, inputs, panels |
| `text-app-text`, `text-app-muted`, `text-app-faint` | Primary, secondary, tertiary text |
| `text-app-accent`, `text-app-accent-hover`, `bg-app-accent-muted` | Brand accent and soft fills |
| `rounded-app-sm` … `rounded-app-xl` | Consistent corner radius |
| `shadow-app-soft`, `shadow-app-glow` | Depth and focus emphasis |
| `px-app-page`, `py-app-page`, `*-app-page-lg` | Page gutters |
| `font-sans` | DM Sans (via `--font-sans`) |

Focus styles use a visible **outline** on interactive elements (`outline-app-accent`) for keyboard accessibility.

## 3. Component structure and hierarchy

```
App
├── Sidebar (desktop rail + mobile drawer)
└── main
    └── AppRoutes
        └── [Layouts / Pages]
            └── PageShell (max-width, padding)
                ├── PageHeader (title, description, actions)
                └── Content sections (often Surface, charts, tables)
```

**`Surface`**: default card container (border, surface fill, soft shadow). Variants: `default`, `muted`, `inset`. Padding: `none` | `sm` | `md` | `lg`.

**`Button`**: `primary` | `secondary` | `ghost` | `danger` | `outline` — used where a consistent button treatment is needed without relying on global `button` resets.

## 4. Before vs after (high level)

| Area | Before | After |
|------|--------|--------|
| Tokens | Ad hoc hex / `white/opacity` strings repeated | Named `app-*` theme utilities |
| Dashboard | Extra fake sidebar + mixed spacing | Single nav model; `PageShell` + widgets on `Surface` |
| Mobile nav | Narrow rail only | Drawer + FAB; labeled links |
| Auth / landing | Presentable but isolated styling | Same tokens as app; clearer hierarchy |
| Auth loading | Blank `null` while auth ready | Accessible loading indicator |
| Library pagination reset | `useEffect` + `setState` | `key={filterKey}` on paginated subtree (avoids effect churn) |

## 5. Responsiveness strategy

- **Breakpoints**: Tailwind defaults (`sm`, `md`, `lg`, `xl`). Icon rail visible from `md` upward; mobile menu below `md`.
- **PageShell**: `max-w-6xl` default, `wide` flag for `max-w-[1600px]` (dashboard, library, analytics).
- **Tables**: Horizontal scroll wrapper where needed (e.g. My Content).
- **Admin**: Stacked layout on small viewports; horizontal scroll for tab buttons to avoid clipping.
- **Touch targets**: Larger padding on primary mobile controls (menu FAB, drawer header close).

## 6. UX improvements (and why)

- **One navigation model**: Removing the dashboard’s duplicate sidebar reduces confusion about where to navigate.
- **Predictable page framing**: `PageHeader` + `PageShell` make titles, descriptions, and actions discoverable in the same place on each screen.
- **Feedback**: Protected-route loading and clearer error surfaces in analytics improve perceived performance and failure states.
- **Keyboard / a11y**: `aria-expanded`, `role="menu"` on flyouts, focus outlines, and `aria-label`s on icon-only controls.
- **Motion**: Short `animate-fade-in` and hover lifts on cards/actions; kept subtle to avoid distraction.

## 7. Files touched (UI scope)

Key paths include the above plus: `src/components/analytics/*`, `src/components/library/*`, `src/components/admin/*`, `src/components/templates/*`, `src/layouts/EditorLayout.tsx`, `src/layouts/PreviewLayout.tsx`, `src/layouts/ReviewLayout.tsx`, `src/layouts/ReadingLayout.tsx`, `src/layouts/VersionHistoryLayout.tsx`, `src/layouts/ChatLayout.tsx`, `src/layouts/AssetLayout.tsx`, `src/pages/AI/AITutorPage.tsx`, `src/components/ReviewFeedbackModal.tsx`, `src/components/ManageReviewersModal.tsx`, and other feature components touched during the global `app-*` migration.

---

*For implementation details, prefer reading the source above; this file is the human-facing map of the design system.*
