# anchornet-backend

**AnchorNet** API — routing, settlement, and liquidity indexer for the AnchorNet liquidity coordination network (Stellar anchors).

## Overview

- **Stack:** Node.js, Express, TypeScript
- **Role:** REST API for routing, settlement engine, and liquidity analytics

## Prerequisites

- Node.js 18+
- npm (or yarn/pnpm)

## Setup

```bash
# Clone the repo (or use your fork)
git clone <repo-url>
cd anchornet-backend

# Install dependencies
npm install

# Run in development
npm run dev
```

Server runs at `http://localhost:3001` by default. Set `PORT` to override.

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run production build |
| `npm test` | Run tests (Jest) |
| `npm run lint` | Run ESLint |

## API (starter)

- `GET /health` – health check
- `GET /api/v1/info` – API name and version

## Contributing

1. Fork the repo and create a branch from `main`.
2. Install deps: `npm install`. Run tests: `npm test`; lint: `npm run lint`.
3. Open a pull request. CI runs lint, build, and tests on push/PR to `main`.

## License

MIT
