import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Évite la résolution « realpath » des fichiers, qui échoue dans certains dossiers virtualisés de Windows.
  resolve: { preserveSymlinks: true },
});
