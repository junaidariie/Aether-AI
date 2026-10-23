import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The backend's CORS policy allows http://localhost:5173 and http://127.0.0.1:5173,
// so the dev server is pinned to 5173. No proxy is needed: the app calls
// VITE_API_BASE_URL directly (see src/services/api.js).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173 },
});
