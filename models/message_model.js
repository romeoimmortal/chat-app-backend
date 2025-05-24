// models/message_model.js
// Defines the Mongoose schema and model for Message, now including read status and message type.

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
  // New fields to align with old Firebase Message model
  readStatus: { // Corresponds to 'read' in old Firebase Message (empty string if not read, timestamp if read)
    type: Date, // Store as Date, will be null if not read, or a Date object
    default: null, // Default to null (not read)
  },
  type: { // Corresponds to 'type' in old Firebase Message (text or image)
    type: String,
    enum: ['text', 'image'], // Enforce type to be either 'text' or 'image'
    required: true,
    default: 'text', // Default message type is text
  },
});

module.exports = mongoose.model('Message', MessageSchema); // Export the Message model
