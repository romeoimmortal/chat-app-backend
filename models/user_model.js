// models/user_model.js
// Defines the Mongoose schema and model for User.

const mongoose = require('mongoose'); // MongoDB object modeling tool
const bcrypt = require('bcryptjs'); // For hashing passwords

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true, // Ensure usernames are unique
    trim: true, // Remove whitespace from both ends of a string
    minlength: 3, // Minimum length for username
  },
  password: {
    type: String,
    required: true,
    minlength: 6, // Minimum length for password
  },
  createdAt: {
    type: Date,
    default: Date.now, // Automatically set creation timestamp
  },
});

// Pre-save hook to hash the password before saving a new user or updating password
UserSchema.pre('save', async function (next) {
  // Only hash if the password field is modified or it's a new user
  if (!this.isModified('password')) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10); // Generate a salt
    this.password = await bcrypt.hash(this.password, salt); // Hash the password
    next();
  } catch (err) {
    next(err); // Pass error to the next middleware
  }
});

// Method to compare entered password with hashed password
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema); // Export the User model
