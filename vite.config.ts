
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Se il tuo XAMPP risponde su una porta diversa (es. 80 o 8080), modificala qui
    proxy: {
      '/api.php': {
        target: 'http://localhost', 
        changeOrigin: true,
      },
      '/save.php': {
        target: 'http://localhost',
        changeOrigin: true,
      }
    }
  }
});
