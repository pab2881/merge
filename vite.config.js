// In vite.config.js
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3002',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, '')
    },
  },
}