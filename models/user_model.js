// models/user_model.js
// Defines the Mongoose schema and model for User.

const mongoose = require('mongoose'); // MongoDB object modeling tool
const bcrypt = require('bcryptjs'); // For hashing passwords

const UserSchema = new mongoose.Schema({
  // Changed from 'username' to 'email' to match Flutter app's authentication
  email: {
    type: String,
    required: true,
    unique: true, // Ensure emails are unique
    trim: true, // Remove whitespace from both ends of a string
    lowercase: true, // Store emails in lowercase for consistency
  },
  password: {
    type: String,
    required: true,
    minlength: 6, // Minimum length for password
  },
  // New fields to match the ChatUser model in Flutter
  fullName: { // Corresponds to 'name' in Flutter's ChatUser
    type: String,
    required: true,
    trim: true,
  },
  profilePic: { // Corresponds to 'image' in Flutter's ChatUser
    type: String,
    default: '', // Default empty string if no profile picture
  },
  about: { // Corresponds to 'about' in Flutter's ChatUser
    type: String,
    default: 'Hey, I\'m using We Chat!', // Default about status
  },
  isOnline: { // Corresponds to 'isOnline' in Flutter's ChatUser
    type: Boolean,
    default: false,
  },
  lastActive: { // Corresponds to 'lastActive' in Flutter's ChatUser (timestamp)
    type: Date,
    default: null, // Null initially, updated on disconnect/connect
  },
  pushToken: { // Corresponds to 'pushToken' in Flutter's ChatUser (for push notifications)
    type: String,
    default: '',
  },
  createdAt: { // Corresponds to 'createdAt' in Flutter's ChatUser (timestamp)
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