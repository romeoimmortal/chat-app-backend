// db.js
// Handles the connection to the MongoDB database.

const mongoose = require('mongoose'); // MongoDB object modeling tool

// Function to connect to MongoDB
const connectDB = async () => {
  try {
    // The MongoDB URI is typically stored in a .env file for security
    const mongoURI = process.env.MONGO_URI;

    if (!mongoURI) {
      console.error('FATAL ERROR: MONGO_URI is not defined in .env file.');
      process.exit(1); // Exit the process if URI is missing
    }

    await mongoose.connect(mongoURI);
    console.log('MongoDB Connected...');
  } catch (err) {
    console.error('MongoDB Connection Error:', err.message);
    // Exit process with failure
    process.exit(1);
  }
};

module.exports = connectDB; // Export the connection function
