require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./database');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');

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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Start Server
async function startServer() {
  await connectDB(MONGO_URI);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OCTAVE Backend listening on port ${PORT}`);
  });
}

startServer();
