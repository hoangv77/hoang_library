import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { localEditingPlugin } from './scripts/local-editing';

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), 'VITE_');
  for (const [name, value] of Object.entries(environment)) {
    let serviceRole = false;
    try { serviceRole = JSON.parse(Buffer.from(value.split('.')[1] ?? '', 'base64url').toString()).role === 'service_role'; } catch { /* Not a JWT. */ }
    if (value && (/TMDB|SERVICE_ROLE|SECRET/i.test(name) || value.startsWith('sb_secret_') || serviceRole)) {
      throw new Error('A private credential is configured with a VITE_ prefix. Remove it before serving or building.');
    }
  }
  return {
    plugins: [localEditingPlugin(), react(), tailwindcss()],
    build: { rollupOptions: { output: { manualChunks(id) {
      const filename = id.replaceAll('\\', '/');
      // Independently cached, bounded collection data avoids one large app bundle.
      if (filename.endsWith('/src/data/music-tracks.ts')) return 'music-tracks';
      if (filename.endsWith('/src/data/music.ts')) return 'music-albums';
      if (filename.includes('/node_modules/')) return 'vendor';
    } } } },
  };
});
