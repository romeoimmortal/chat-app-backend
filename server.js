// server.js
// This is the main entry point for your Node.js backend server.

const express = require('express'); // Web framework for handling HTTP requests
const http = require('http'); // Node.js built-in HTTP module
const socketIo = require('socket.io'); // WebSocket library for real-time communication
const mongoose = require('mongoose'); // MongoDB object modeling tool
const cors = require('cors'); // Middleware for enabling Cross-Origin Resource Sharing
const dotenv = require('dotenv'); // Loads environment variables from a .env file

// --- DEBUGGING LINES START ---
console.log('--- Dotenv Debugging ---');
console.log('Current working directory (process.cwd()):', process.cwd());
const dotenvResult = dotenv.config(); // Load environment variables from .env file
console.log('Dotenv config result:', dotenvResult); // Shows if .env was found and parsed
console.log('Value of process.env.MONGO_URI (after dotenv.config()):', process.env.MONGO_URI);
console.log('Value of process.env.JWT_SECRET (after dotenv.config()):', process.env.JWT_SECRET);
console.log('--- End Dotenv Debugging ---');
// --- DEBUGGING LINES END ---


// Import database connection function
const connectDB = require('./db');
// Import routes
const authRoutes = require('./routes/auth_routes');
const userRoutes = require('./routes/user_routes');
// Import Socket.IO handler
const handleChatSockets = require('./sockets/chat_sockets');

// Initialize Express app
const app = express();
// Create an HTTP server using the Express app
const server = http.createServer(app);
// Initialize Socket.IO with the HTTP server
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow all origins for development. In production, specify your Flutter app's domain.
    methods: ["GET", "POST"]
  }
});

// Connect to MongoDB
connectDB(); // This calls the function from db.js

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON request bodies

// API Routes
app.use('/api/auth', authRoutes); // Authentication routes (signup, login)
app.use('/api/users', userRoutes); // User-related routes (get all users, search)

// Socket.IO connection handling
handleChatSockets(io); // Pass the Socket.IO instance to the handler

// Define the port to listen on
const PORT = process.env.PORT || 3000; // Use port from .env or default to 3000

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`HTTP API available at http://localhost:${PORT}/api`);
  console.log(`WebSocket server available at ws://localhost:${PORT}`);
});