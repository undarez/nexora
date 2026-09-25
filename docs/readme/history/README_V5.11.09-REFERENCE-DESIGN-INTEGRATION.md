# NEXORA V5.11.09 — Reference Design Integration

## Objective
Align the authenticated web application with the approved NEXORA fintech dashboard reference: clean light workspace, indigo/violet brand, rounded cards, compact financial KPIs, objective progress, performance visualization, account allocation, recent operations, insights and a persistent LIA entry point.

## Scope
- UI/UX only; financial/business rules are unchanged.
- Shared design tokens and card/control treatment apply across protected screens.
- Desktop application chrome now includes the compact search/user topbar shown by the reference design.
- Sidebar uses the indigo/violet active state and the same spacing language as the dashboard.
- Dashboard was reorganized to expose the information hierarchy of the reference design while using NEXORA's real unified financial context.
- Recent transactions are read from the existing bank/manual ledgers and never fabricated.
- Goal progress uses the existing `goals` projection.
- Account allocation represents actual connected-vs-manual liquidity, rather than inventing unsupported investment holdings.
- LIA quick prompts route into the existing `/lia` experience.

## Dark mode
Dark mode is redesigned as a navy/indigo workspace rather than a simple inversion: readable slate text, elevated cards, violet brand accents, calm borders and the same information hierarchy as light mode.

## No generated images integrated
No generated image is used by the application. The reference image is implemented through CSS, existing SVG/logo assets, Lucide icons and the existing data components.

## Validation
Static/source validation should be run with the project's existing regression scripts. A full Next.js build still requires the project's dependencies (`npm ci`) in an environment with network access.
