# Math Practice App

Flash-card arithmetic practice for children: addition, subtraction,
multiplication and division at four levels, with explanations, statistics and
practice on past mistakes. Everything runs in the browser; there is no server
and no account.

## Commands

| Command                | What it does                                           |
| ---------------------- | ------------------------------------------------------ |
| `npm install`          | Installs the dependencies (Node 20 or newer).          |
| `npm run dev`          | Starts the development server.                         |
| `npm test`             | Runs the unit, component and integration tests.        |
| `npm run lint`         | Checks the code with ESLint.                           |
| `npm run format:check` | Checks the formatting with Prettier.                   |
| `npm run build`        | Type-checks and builds the production files in `dist`. |
| `npm run preview`      | Serves the production build locally, to try it out.    |

## Deploying

`npm run build` makes a static site in `dist`; any static host can serve it.

The app uses React Router with ordinary paths (`/statistics`, `/settings`, …),
so the host must answer every path with `index.html`, or opening a link or
refreshing on any page but the first gives a "not found" error from the host.

- **Netlify** and **Cloudflare Pages**: handled by `public/_redirects`, which
  is copied into `dist`.
- **Vercel**: add a rewrite of `/(.*)` to `/index.html` in `vercel.json`.
- **GitHub Pages**: has no rewrites; copy `dist/index.html` to `dist/404.html`
  before publishing, and set Vite's `base` if the site is not at the domain root.

## Privacy

- No personal information is asked for or collected: there are no accounts,
  names or text boxes.
- Practice data is kept only in the browser's `localStorage`, under keys that
  start with `mathPractice.`, and is never sent anywhere. The app makes no
  network requests after it loads, and has no analytics, tracking or
  advertising.
- Clearing the browser's history or site data erases the progress, as the
  Settings page explains. Settings → Clear All Application Data erases it from
  inside the app.

## Documents

- `specification.md`: what the app must do.
- `TODO.md`: the build plan, phase by phase.
