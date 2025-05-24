// routes/user_routes.js
// Handles user-related API endpoints (e.g., fetching all users, profile updates).

const express = require('express'); // Express router
const User = require('../models/user_model'); // User model
const auth = require('../middleware/auth_middleware'); // Authentication middleware
const multer = require('multer'); // For handling multipart/form-data (file uploads)
const path = require('path'); // Node.js path module for handling file paths
const fs = require('fs'); // Node.js file system module

const router = express.Router(); // Create an Express router

// --- Multer Configuration for Profile Picture Uploads ---
// Ensure the 'uploads' directory exists
const uploadDir = 'uploads/profile_pics';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); // Files will be stored in the 'uploads/profile_pics' directory
  },
  filename: function (req, file, cb) {
    // Use the user's ID as the filename to ensure uniqueness and easy retrieval
    // Append original extension to keep file type
    const ext = path.extname(file.originalname);
    cb(null, req.user.id + ext); // req.user.id is set by auth_middleware
  },
});

// Filter to allow only image files
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
});

// --- API Routes ---

// @route   GET /api/users
// @desc    Get all users (excluding the authenticated user)
// @access  Private (requires JWT)
router.get('/', auth, async (req, res) => {
  try {
    // Find all users, but exclude the currently authenticated user
    // req.user.id is set by the auth_middleware
    const users = await User.find({ _id: { $ne: req.user.id } })
      .select('-password') // Exclude password field
      .sort({ fullName: 1 }); // Sort by full name for consistent listing

    // Map to a format suitable for Flutter, ensuring IDs are strings and dates are ISO strings
    const formattedUsers = users.map(user => ({
      id: user._id.toString(),
      username: user.username,
      fullName: user.fullName,
      profilePic: user.profilePic,
      about: user.about,
      isOnline: user.isOnline,
      lastActive: user.lastActive ? user.lastActive.toISOString() : null,
      pushToken: user.pushToken,
      createdAt: user.createdAt.toISOString(),
    }));

    res.json(formattedUsers);
  } catch (err) {
    console.error('Get all users error:', err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET /api/users/:id
// @desc    Get a single user's profile by ID
// @access  Private (requires JWT)
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Format user object for Flutter
    const formattedUser = {
      id: user._id.toString(),
      username: user.username,
      fullName: user.fullName,
      profilePic: user.profilePic,
      about: user.about,
      isOnline: user.isOnline,
      lastActive: user.lastActive ? user.lastActive.toISOString() : null,
      pushToken: user.pushToken,
      createdAt: user.createdAt.toISOString(),
    };

    res.json(formattedUser);
  } catch (err) {
    console.error('Get single user error:', err.message);
    // Handle CastError if ID format is invalid
    if (err.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }
    res.status(500).send('Server error');
  }
});


// @route   PUT /api/users/profile
// @desc    Update authenticated user's profile information (fullName, about, pushToken)
// @access  Private (requires JWT)
router.put('/profile', auth, async (req, res) => {
  const { fullName, about, pushToken } = req.body; // Only allow these fields to be updated via this route

  try {
    const user = await User.findById(req.user.id); // Get user from authenticated token

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update fields if provided in the request body
    if (fullName !== undefined) user.fullName = fullName;
    if (about !== undefined) user.about = about;
    if (pushToken !== undefined) user.pushToken = pushToken; // For local notification token

    await user.save(); // Save updated user

    // Return updated user profile
    const updatedUser = {
      id: user._id.toString(),
      username: user.username,
      fullName: user.fullName,
      profilePic: user.profilePic,
      about: user.about,
      isOnline: user.isOnline,
      lastActive: user.lastActive ? user.lastActive.toISOString() : null,
      pushToken: user.pushToken,
      createdAt: user.createdAt.toISOString(),
    };

    res.json({ message: 'Profile updated successfully', user: updatedUser });
  } catch (err) {
    console.error('Update profile error:', err.message);
    res.status(500).send('Server error');
  }
});

// @route   PUT /api/users/profile/picture
// @desc    Upload/Update authenticated user's profile picture
// @access  Private (requires JWT)
router.put('/profile/picture', auth, upload.single('profilePic'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      // If user not found, delete the uploaded file
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting uploaded file:', err);
      });
      return res.status(404).json({ message: 'User not found' });
    }

    // Construct the URL for the profile picture
    // Assuming your server serves static files from the root, e.g., /uploads/profile_pics/userId.ext
    const profilePicUrl = `/uploads/profile_pics/${req.file.filename}`;

    // Update user's profilePic field in the database
    user.profilePic = profilePicUrl;
    await user.save();

    // Return updated user profile
    const updatedUser = {
      id: user._id.toString(),
      username: user.username,
      fullName: user.fullName,
      profilePic: user.profilePic, // Send the new URL
      about: user.about,
      isOnline: user.isOnline,
      lastActive: user.lastActive ? user.lastActive.toISOString() : null,
      pushToken: user.pushToken,
      createdAt: user.createdAt.toISOString(),
    };

    res.json({ message: 'Profile picture updated successfully', user: updatedUser });
  } catch (err) {
    console.error('Profile picture upload error:', err.message);
    // If multer error (e.g., file size limit), it will be caught here
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: err.message });
    }
    // If other errors, delete the uploaded file if it exists
    if (req.file) {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error('Error deleting uploaded file on error:', unlinkErr);
      });
    }
    res.status(500).send('Server error during profile picture upload.');
  }
});

module.exports = router; // Export the router
