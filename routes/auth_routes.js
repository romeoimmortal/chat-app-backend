// routes/auth_routes.js
// Handles user authentication (signup and login) API endpoints.

const express = require('express'); // Express router
const bcrypt = require('bcryptjs'); // For password comparison
const jwt = require('jsonwebtoken'); // For creating JSON Web Tokens
const User = require('../models/user_model'); // User model

const router = express.Router(); // Create an Express router

// @route   POST /api/auth/signup
// @desc    Register a new user with username, password, and full name
// @access  Public
router.post('/signup', async (req, res) => {
  // Destructure username, password, and fullName from the request body
  const { username, password, fullName } = req.body;

  // Basic validation for required fields
  if (!username || !password || !fullName) {
    return res.status(400).json({ message: 'Please enter username, password, and full name.' });
  }

  try {
    // Check if username already exists
    let user = await User.findOne({ username });
    if (user) {
      return res.status(400).json({ message: 'Username already exists. Please choose a different one.' });
    }

    // Create new user instance with all required fields
    user = new User({
      username,
      password, // Password will be hashed by the pre-save hook in user_model.js
      fullName, // Store the full name
      createdAt: Date.now(), // Set creation timestamp as Date object
      lastActive: null, // Set last active to null initially
      isOnline: false, // Default to offline on creation
      profilePic: '', // Default empty profile picture URL
      about: "Hey, I'm using Node Chat!", // Default about message
      pushToken: '', // Default empty push token
    });

    await user.save(); // Save the new user to the database

    // Create and sign a JWT token for the newly registered user
    const payload = {
      user: {
        id: user.id, // MongoDB's _id is converted to 'id' by Mongoose
        username: user.username,
        fullName: user.fullName, // Include full name in the JWT payload
        // Do NOT include password or sensitive info here
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET, // Secret key from .env
      { expiresIn: '7d' }, // Token expires in 7 days (increased for convenience)
      (err, token) => {
        if (err) throw err;
        // Respond with success message and the JWT token
        res.status(201).json({
          message: 'User registered successfully!',
          token,
          user: { // Return full user object for client-side state
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            profilePic: user.profilePic,
            about: user.about,
            isOnline: user.isOnline,
            lastActive: user.lastActive ? user.lastActive.toISOString() : null, // Convert Date to ISO string
            pushToken: user.pushToken,
            createdAt: user.createdAt.toISOString(), // Convert Date to ISO string
          }
        });
      }
    );
  } catch (err) {
    console.error('Signup error:', err.message);
    // Handle duplicate key error specifically for username if it occurs unexpectedly
    if (err.code === 11000 && err.keyPattern && err.keyPattern.username) {
      return res.status(400).json({ message: 'Username already exists. Please choose a different one.' });
    }
    res.status(500).send('Server error during signup.');
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // Basic validation
  if (!username || !password) {
    return res.status(400).json({ message: 'Please enter username and password.' });
  }

  try {
    // Check if user exists
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    // Compare entered password with hashed password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    // Create and sign a JWT token for the authenticated user
    const payload = {
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName, // Include full name in the JWT payload
        // Do NOT include password or sensitive info here
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' }, // Token expires in 7 days
      (err, token) => {
        if (err) throw err;
        // Respond with success message and the JWT token
        res.json({
          message: 'Logged in successfully!',
          token,
          user: { // Return full user object for client-side state
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            profilePic: user.profilePic,
            about: user.about,
            isOnline: user.isOnline,
            lastActive: user.lastActive ? user.lastActive.toISOString() : null, // Convert Date to ISO string
            pushToken: user.pushToken,
            createdAt: user.createdAt.toISOString(), // Convert Date to ISO string
          }
        });
      }
    );
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).send('Server error during login.');
  }
});

module.exports = router; // Export the router
