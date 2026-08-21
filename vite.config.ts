import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Шрифт нужен в браузере для печати кириллицы, поэтому включаем его в JS,
    // а не загружаем отдельным запросом во время печати.
    assetsInlineLimit: 200_000,
  },
})
