import { defineConfig } from 'vite';

// The compiled site also works in a GitHub Pages repository subdirectory.
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: { main: 'index.html', headerPreview: 'header-preview.html' },
    },
  },
});
