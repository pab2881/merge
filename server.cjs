const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(helmet({
  contentSecurityPolicy: false // Disable CSP for simplicity in development
}));
app.use(express.json());

// Serve static files from the Vite build directory
app.use(express.static(path.join(__dirname, 'dist')));

// API route example
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from the API!' });
});

// Fallback for SPA routing
app.get('*', (req, res) => {
  // Don't redirect API calls
  if (req.path.startsWith('/api/')) return;
  
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app; // For Vercel
