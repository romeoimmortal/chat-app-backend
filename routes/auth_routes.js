// routes/auth_routes.js
// Handles user authentication (signup and login) API endpoints.

const express = require('express'); // Express router
const bcrypt = require('bcryptjs'); // For password comparison
const jwt = require('jsonwebtoken'); // For creating JSON Web Tokens
const User = require('../models/user_model'); // User model

const router = express.Router(); // Create an Express router

// @route   POST /api/auth/signup
// @desc    Register a new user
// @access  Public
router.post('/signup', async (req, res) => {
  const { username, password } = req.body;

  // Basic validation
  if (!username || !password) {
    return res.status(400).json({ message: 'Please enter all fields' });
  }

  try {
    // Check if user already exists
    let user = await User.findOne({ username });
    if (user) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Create new user instance
    user = new User({
      username,
      password, // Password will be hashed by the pre-save hook in user_model.js
    });

    await user.save(); // Save the user to the database

    // Create and sign a JWT token
    const payload = {
      user: {
        id: user.id, // MongoDB's _id is converted to 'id' by Mongoose
        username: user.username,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET, // Secret key from .env
      { expiresIn: '1h' }, // Token expires in 1 hour
      (err, token) => {
        if (err) throw err;
        res.status(201).json({ message: 'User registered successfully', token });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // Basic validation
  if (!username || !password) {
    return res.status(400).json({ message: 'Please enter all fields' });
  }

  try {
    // Check if user exists
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Compare entered password with hashed password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Create and sign a JWT token
    const payload = {
      user: {
        id: user.id,
        username: user.username,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '1h' },
      (err, token) => {
        if (err) throw err;
        res.json({ message: 'Logged in successfully', token });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router; // Export the router
