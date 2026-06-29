require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('../database');
const authRoutes = require('../routes/auth');
const apiRoutes = require('../routes/api');

const app = express();
const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/octave_tracker';

// Middlewares
app.use(cors({
  origin: '*', // Allow all origins for dev/testing ease
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

// Root welcome
app.get('/', (req, res) => {
  res.json({ message: 'OCTAVE H&W 2026 API Server is running!', health: '/health' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Connect DB on load
connectDB(MONGO_URI);

// Start Server locally if not on Vercel
if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OCTAVE Backend listening on port ${PORT}`);
  });
}

module.exports = app;
