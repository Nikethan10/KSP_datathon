import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/app/',
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        /* Split the heavy renderers out by hand. Left to itself the bundler
           folded maplibre and the whole deck.gl layer set into one 1.6 MB
           chunk named after whichever module happened to be its entry point
           ("text-layer"), so any change to our own code invalidated all of it
           in the browser cache. Named vendor chunks let a UI tweak ship
           without re-downloading the map stack.

           Rolldown (Vite 8) only accepts the function form here; the object
           form is a Rollup-only API. */
        manualChunks(id: string) {
          if (id.includes('node_modules/maplibre-gl')) return 'maplibre'
          if (id.includes('node_modules/@deck.gl')) return 'deck'
          if (id.includes('node_modules/recharts')) return 'charts'
        },
      },
    },
  },
})
