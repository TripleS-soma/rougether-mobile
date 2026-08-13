# rougether-mobile

Mobile app for Rougether (routine/habit tracker + room-decorating game), built with
[Expo](https://expo.dev) + React Native + Expo Router (TypeScript).

This repo is the **dev/test harness**: an app skeleton plus the tooling to build, preview,
type-check, lint, and test components in a tight loop. Screens are ported from
`rougether-prototype` (the Figma Make web prototype) as a later step.

## Getting started

```bash
npm install
npm start        # Expo dev server — press i / a / w for iOS / Android / web
```

## Harness

- **Component gallery** — the `Dev` tab (`/dev` route) renders every component registered in
  [`src/dev/registry.tsx`](src/dev/registry.tsx) in isolation, on device / simulator / web.
  Add an entry when you build a new component. [`BearCheck`](src/components/ui/bear-check.tsx)
  is the reference pattern (pure RN, theme-aware, testable).
- **Routing** — file-based via Expo Router. Routes live in [`src/app`](src/app); tabs are wired
  in [`src/components/app-tabs.tsx`](src/components/app-tabs.tsx) (native) and `app-tabs.web.tsx` (web).

## Scripts

| Command                           | What it does                                    |
| --------------------------------- | ----------------------------------------------- |
| `npm start`                       | Start the Expo dev server                       |
| `npm run typecheck`               | `tsc --noEmit`                                  |
| `npm run lint`                    | ESLint (eslint-config-expo)                     |
| `npm run format` / `format:check` | Prettier write / check                          |
| `npm test` / `test:watch`         | Jest (jest-expo + React Native Testing Library) |

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs typecheck → lint → format check →
test on every push to `main` and on pull requests.
