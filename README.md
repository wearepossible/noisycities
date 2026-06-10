# noisycities

Noise pollution maps for London, Paris and New York.

Built with [React](https://react.dev/) and [Vite](https://vite.dev/).

## Available scripts

In the project directory, you can run:

### `npm install`

Installs the project dependencies. Run this once after cloning, and again
whenever the dependencies change.

### `npm run dev`

Runs the app in development mode. Vite prints a local URL (e.g.
`http://localhost:5173`) — open it in your browser. The page reloads
automatically as you edit files.

### `npm run build`

Builds the app for production into the `build/` folder. The output is minified
and ready to deploy.

### `npm run preview`

Serves the production build from `build/` locally so you can smoke-test it
before deploying.

## Deployment

The site is deployed on Netlify. Build settings are pinned in `netlify.toml`
(`npm run build`, publishing the `build/` folder). Opening a pull request
produces a Netlify Deploy Preview for testing before merging.
