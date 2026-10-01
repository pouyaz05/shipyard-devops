# Shipyard Frontend

React 18 + Vite + TypeScript + Tailwind + React Router.

## Development
```bash
npm install
npm run dev        # http://localhost:5173
```

## Test
```bash
npm test           # vitest, single run
npm run test:watch
```

## Build
```bash
npm run build      # output in dist/
```

## Docker
```bash
docker build -t shipyard-frontend .
docker run --rm -p 8080:8080 shipyard-frontend   # http://localhost:8080
```
The image runs nginx as a non-root user on port 8080 and serves the SPA with a `try_files` fallback to `index.html`.
