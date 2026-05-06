# Searchspace Scavenger Hunt

A gamified, digitally-run scavenger hunt across European cities.Participants visit historically significant sites, complete challenges at each location, and are guided toward registering to vote. The app is mobile-first and runs in the browser — no app store download required.

## Tech Stack

- **Framework:** [Svelte 5](https://svelte.dev/)
- **Build Tool:** [Vite 6](https://vitejs.dev/)
- **Language:** TypeScript
- **Routing:** `svelte-spa-router` (hash-based)
- **Styling:** Vanilla CSS with CSS Custom Properties (tokens)
- **Data:** Static YAML files (bundled at build time)
- **Maps:** [Leaflet](https://leafletjs.com/)
- **Deployment:** [Cloudflare Workers](https://workers.cloudflare.com/)

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (latest LTS recommended)
- `npm` (comes with Node.js)

### Installation

```bash
npm install
```

### Development

Run the development server:

```bash
npm run dev
```

### Building and Deployment

To build for production:

```bash
npm run build
```

To preview the production build locally (using `wrangler` for Cloudflare Workers simulation):

```bash
npm run preview
```

To deploy to Cloudflare:

```bash
npm run deploy
```

## Project Structure

- `src/`: Application source code
  - `pages/`: Svelte page components
  - `components/`: Reusable UI components
  - `stores/`: Svelte stores for state management
  - `data/`: YAML content files and images
  - `theme/`: Theme definitions and token mappings
  - `utils/`: Helper functions and data loaders
- `doc/`: Detailed documentation
  - `architecture.md`: In-depth architectural overview
  - `devlog/`: Development history and decision log
- `public/`: Static assets (favicon, etc.)

## Data Model

The app's content is entirely data-driven via YAML files located in `src/data/text/en/`. Adding a new city or route involves creating new YAML files without changing the application logic.

See `doc/architecture.md` for a detailed breakdown of the YAML schema and project hierarchy.

## Testing and Quality

- **Testing:** `npm test` (Vitest + Svelte Testing Library)
- **Linting:** `npm run lint` (ESLint + Prettier)
- **Type Checking:** `npm run typecheck` (TypeScript + Svelte-check)

## Documentation

For more detailed information, please refer to:
- [Architecture Guide](doc/architecture.md)
- [Setup Guide](doc/setup.md)
- [Attribution and Credits](doc/attribution/credits.md)
