import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        // Libraries change rarely; separate files stay cached across releases.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\/](react|react-dom|react-router|react-router-dom|scheduler|cookie|set-cookie-parser)[\/]/ },
            { name: 'supabase', test: /node_modules[\/]@supabase[\/]/ },
          ],
        },
      },
    },
  },
})
