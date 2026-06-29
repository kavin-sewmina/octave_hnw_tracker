const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_octave_key_2026';
const PLAIN_PASSWORD = process.env.ORGANIZER_PASSWORD || 'octave2026';

// Generate bcrypt hash of password on startup
const PASSWORD_HASH = bcrypt.hashSync(PLAIN_PASSWORD, 10);

router.post('/login', (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  // Compare input password with the hashed password
  const isMatch = bcrypt.compareSync(password, PASSWORD_HASH);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  // Create JWT token for Organizer
  const token = jwt.sign({ role: 'Organizer' }, JWT_SECRET, { expiresIn: '24h' });
  return res.json({ token });
});

module.exports = router;
