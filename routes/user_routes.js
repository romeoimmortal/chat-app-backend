// routes/user_routes.js
// Handles user-related API endpoints (e.g., fetching all users).

const express = require('express'); // Express router
const User = require('../models/user_model'); // User model
const auth = require('../middleware/auth_middleware'); // Authentication middleware

const router = express.Router(); // Create an Express router

// @route   GET /api/users
// @desc    Get all users (excluding the authenticated user)
// @access  Private (requires JWT)
router.get('/', auth, async (req, res) => {
  try {
    // Find all users, but exclude the currently authenticated user
    // req.user.id is set by the auth_middleware
    const users = await User.find({ _id: { $ne: req.user.id } }).select('-password'); // Exclude password field
    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// You might add more user-related routes here later, e.g.,
// router.get('/:id', auth, async (req, res) => { /* Get single user profile */ });
// router.put('/:id', auth, async (req, res) => { /* Update user profile */ });

module.exports = router; // Export the router
