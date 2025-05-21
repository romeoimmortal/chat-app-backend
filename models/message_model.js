// models/message_model.js
// Defines the Mongoose schema and model for Message.

const mongoose = require('mongoose'); // MongoDB object modeling tool

const MessageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId, // Reference to the User who sent the message
    ref: 'User', // Refers to the 'User' model
    required: true,
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId, // Reference to the User who received the message
    ref: 'User', // Refers to the 'User' model
    required: true,
  },
  content: {
    type: String,
    required: true,
    trim: true,
  },
  timestamp: {
    type: Date,
    default: Date.now, // Automatically set message timestamp
  },
  // You might add a 'read' status, 'media' field, etc. later
});

module.exports = mongoose.model('Message', MessageSchema); // Export the Message model
