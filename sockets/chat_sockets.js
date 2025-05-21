// sockets/chat_sockets.js
// Handles real-time chat communication using Socket.IO.

const jwt = require('jsonwebtoken'); // For verifying JWT tokens
const User = require('../models/user_model'); // User model
const Message = require('../models/message_model'); // Message model

module.exports = function (io) {
  // Middleware for Socket.IO to authenticate connections
  io.use(async (socket, next) => {
    const token = socket.handshake.headers.authorization;
    const userIdFromQuery = socket.handshake.query.userId; // Get userId from query params

    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const tokenParts = token.split(' ');
    if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer') {
      return next(new Error('Authentication error: Token format is "Bearer <token>"'));
    }
    const actualToken = tokenParts[1];

    try {
      const decoded = jwt.verify(actualToken, process.env.JWT_SECRET);
      // Attach authenticated user's ID to the socket object
      socket.userId = decoded.user.id; // This is the MongoDB _id
      socket.username = decoded.user.username; // Also attach username for convenience

      // OPTIONAL: Verify if the userId from query matches the token's userId
      // This check is good for security, ensuring the client is who they claim to be.
      // Make sure userIdFromQuery (from Flutter) is the actual MongoDB _id.
      if (userIdFromQuery && userIdFromQuery !== decoded.user.id) { // FIX: Compare with decoded.user.id
        console.error(`Socket authentication error: User ID mismatch. Query ID: ${userIdFromQuery}, Token ID: ${decoded.user.id}`);
        return next(new Error('Authentication error: User ID mismatch'));
      }

      next(); // Authentication successful, proceed with connection
    } catch (err) {
      console.error('Socket authentication error:', err.message);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // Event listener for new Socket.IO connections
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.username} (ID: ${socket.userId})`);

    // Handle 'join_room' event
    socket.on('join_room', async (roomId) => {
      socket.join(roomId); // Join the specified chat room
      console.log(`${socket.username} joined room: ${roomId}`);

      try {
        // Fetch chat history for this room
        const [user1Id, user2Id] = roomId.split('_');

        // Find messages where sender and receiver match the room participants in any order
        const messages = await Message.find({
          $or: [
            { senderId: user1Id, receiverId: user2Id },
            { senderId: user2Id, receiverId: user1Id },
          ],
        })
          .sort({ timestamp: 1 }) // Sort by timestamp ascending
          // Populate sender and receiver details, but only get the _id and username
          .populate('senderId', '_id username') 
          .populate('receiverId', '_id username') 
          .lean(); // Return plain JavaScript objects

        // Map messages to a format suitable for Flutter (using actual IDs)
        const formattedMessages = messages.map(msg => ({
          _id: msg._id.toString(),
          senderId: msg.senderId ? msg.senderId._id.toString() : null, // Use actual ID from populated object, add null check
          receiverId: msg.receiverId ? msg.receiverId._id.toString() : null, // Use actual ID from populated object, add null check
          content: msg.content,
          timestamp: msg.timestamp.toISOString(),
        }));

        // Emit chat history only to the user who just joined the room
        socket.emit('chat_history', formattedMessages);
      } catch (err) {
        console.error('Error fetching chat history:', err.message);
        socket.emit('chat_error', 'Failed to load chat history.');
      }
    });

    // Handle 'send_message' event
    socket.on('send_message', async (data) => {
      const { receiverId, content, timestamp } = data; // timestamp is from client

      // Basic validation
      if (!receiverId || !content) {
        return socket.emit('chat_error', 'Invalid message data');
      }

      try {
        // Use socket.userId directly as the sender's MongoDB _id
        const senderId = socket.userId; 
        const receiver = await User.findById(receiverId); // Find receiver by their MongoDB _id

        if (!receiver) {
          console.error(`Receiver not found for ID: ${receiverId}`);
          return socket.emit('chat_error', 'Receiver not found');
        }

        const newMessage = new Message({
          senderId: senderId, // Use the authenticated sender's MongoDB _id
          receiverId: receiver._id, // Use MongoDB _id for receiver
          content,
          timestamp: new Date(timestamp), // Use client-provided timestamp
        });

        await newMessage.save(); // Save message to DB

        // Determine the room ID for broadcasting
        const participants = [senderId.toString(), receiver._id.toString()].sort();
        const roomId = participants.join('_');

        // Prepare message for broadcasting (use actual IDs)
        const messageToEmit = {
          _id: newMessage._id.toString(),
          senderId: newMessage.senderId.toString(), // Use the ID from the saved message
          receiverId: newMessage.receiverId.toString(), // Use the ID from the saved message
          content: newMessage.content,
          timestamp: newMessage.timestamp.toISOString(),
        };

        // Emit the message to everyone in the room (including sender)
        io.to(roomId).emit('receive_message', messageToEmit);
        console.log(`Message sent in room ${roomId}: ${content}`);
      } catch (err) {
        console.error('Error sending message:', err.message);
        socket.emit('chat_error', 'Failed to send message.');
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.username} (ID: ${socket.userId})`);
      // Clean up any user-specific data if necessary
    });
  });
};
