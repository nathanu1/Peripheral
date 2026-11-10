import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const serverPort = Number(process.env.PORT ?? 8787);

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Phones only expose the camera on a secure origin, so dev is HTTPS with a self-signed cert.
    basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Peripheral',
        short_name: 'Peripheral',
        description: 'A calm perception overlay for your phone camera.',
        display: 'standalone',
        orientation: 'any',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
  server: {
    host: true, // listen on the LAN so a phone can reach it
    port: 5173,
    // The phone talks to one origin; the API key stays on the server behind this proxy.
    proxy: { '/api': `http://localhost:${serverPort}` },
  },
  preview: { host: true, port: 4173, proxy: { '/api': `http://localhost:${serverPort}` } },
});
