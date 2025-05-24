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
      console.error('Socket authentication error: No token provided');
      return next(new Error('Authentication error: No token provided'));
    }

    const tokenParts = token.split(' ');
    if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer') {
      console.error('Socket authentication error: Token format is "Bearer <token>"');
      return next(new Error('Authentication error: Token format is "Bearer <token>"'));
    }
    const actualToken = tokenParts[1];

    try {
      const decoded = jwt.verify(actualToken, process.env.JWT_SECRET);
      // Attach authenticated user's ID to the socket object
      socket.userId = decoded.user.id; // This is the MongoDB _id
      socket.username = decoded.user.username; // Also attach username for convenience
      socket.fullName = decoded.user.fullName; // Attach full name

      // OPTIONAL: Verify if the userId from query matches the token's userId
      if (userIdFromQuery && userIdFromQuery !== decoded.user.id) {
        console.error(`Socket authentication error: User ID mismatch. Query ID: ${userIdFromQuery}, Token ID: ${decoded.user.id}`);
        return next(new Error('Authentication error: User ID mismatch'));
      }

      next(); // Authentication successful, proceed with connection
    } catch (err) {
      console.error('Socket authentication error:', err.message);
      // Emit a custom auth_error event to the client
      socket.emit('auth_error', { message: 'Invalid token or authentication failed.' });
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // Event listener for new Socket.IO connections
  io.on('connection', async (socket) => {
    console.log(`User connected: ${socket.fullName} (ID: ${socket.userId})`);

    // Update user's online status and last active time on connect
    try {
      await User.findByIdAndUpdate(
        socket.userId,
        { isOnline: true, lastActive: Date.now() },
        { new: true } // Return the updated document
      );
      console.log(`User ${socket.fullName} set to online.`);
    } catch (err) {
      console.error(`Error updating online status for ${socket.userId} on connect:`, err.message);
    }

    // Handle 'join_room' event
    socket.on('join_room', async (roomId) => {
      socket.join(roomId); // Join the specified chat room
      console.log(`${socket.fullName} joined room: ${roomId}`);

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
          .populate('senderId', '_id fullName profilePic') // Populate sender details
          .populate('receiverId', '_id fullName profilePic') // Populate receiver details
          .lean(); // Return plain JavaScript objects

        // Map messages to a format suitable for Flutter (using actual IDs and new fields)
        const formattedMessages = messages.map(msg => ({
          id: msg._id.toString(), // Renamed from _id to id for Flutter model
          senderId: msg.senderId ? msg.senderId._id.toString() : null,
          receiverId: msg.receiverId ? msg.receiverId._id.toString() : null,
          content: msg.content,
          timestamp: msg.timestamp.toISOString(),
          readStatus: msg.readStatus ? msg.readStatus.toISOString() : null, // Convert Date to ISO string or null
          type: msg.type,
          // Include sender and receiver full profile for display if needed by Flutter
          sender: msg.senderId ? {
            id: msg.senderId._id.toString(),
            fullName: msg.senderId.fullName,
            profilePic: msg.senderId.profilePic,
          } : null,
          receiver: msg.receiverId ? {
            id: msg.receiverId._id.toString(),
            fullName: msg.receiverId.fullName,
            profilePic: msg.receiverId.profilePic,
          } : null,
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
      const { receiverId, content, timestamp, type } = data; // Added 'type' from client

      // Basic validation
      if (!receiverId || !content || !type) {
        return socket.emit('chat_error', 'Invalid message data');
      }

      try {
        const senderId = socket.userId;
        const receiver = await User.findById(receiverId);

        if (!receiver) {
          console.error(`Receiver not found for ID: ${receiverId}`);
          return socket.emit('chat_error', 'Receiver not found');
        }

        const newMessage = new Message({
          senderId: senderId,
          receiverId: receiver._id,
          content,
          timestamp: new Date(timestamp), // Use client-provided timestamp
          type: type, // Store message type
          readStatus: null, // New messages are unread
        });

        await newMessage.save(); // Save message to DB

        // Determine the room ID for broadcasting
        const participants = [senderId.toString(), receiver._id.toString()].sort();
        const roomId = participants.join('_');

        // Prepare message for broadcasting (use actual IDs and new fields)
        const messageToEmit = {
          id: newMessage._id.toString(), // Renamed from _id to id for Flutter model
          senderId: newMessage.senderId.toString(),
          receiverId: newMessage.receiverId.toString(),
          content: newMessage.content,
          timestamp: newMessage.timestamp.toISOString(),
          readStatus: newMessage.readStatus ? newMessage.readStatus.toISOString() : null,
          type: newMessage.type,
          // Include sender and receiver full profile for display if needed by Flutter
          sender: {
            id: socket.userId.toString(),
            fullName: socket.fullName,
            profilePic: (await User.findById(socket.userId)).profilePic, // Get sender's profilePic
          },
          receiver: {
            id: receiver._id.toString(),
            fullName: receiver.fullName,
            profilePic: receiver.profilePic,
          },
        };

        // Emit the message to everyone in the room (including sender)
        io.to(roomId).emit('receive_message', messageToEmit);
        console.log(`Message sent in room ${roomId}: ${content} (Type: ${type})`);

        // --- Local Notification Trigger Logic (for receiver) ---
        // If receiver is NOT in the current chat room, send a notification event
        // This is a simplified check. A more robust solution might check if the receiver
        // is online but not in the specific chat room.
        const receiverSocket = Array.from(io.sockets.sockets.values()).find(
          (s) => s.userId === receiverId && s.connected && !s.rooms.has(roomId)
        );

        if (receiverSocket) {
          console.log(`Sending local notification trigger to ${receiver.fullName}`);
          receiverSocket.emit('trigger_local_notification', {
            senderId: messageToEmit.senderId,
            senderName: messageToEmit.sender.fullName, // Sender's full name
            messageContent: messageToEmit.content,
            messageType: messageToEmit.type,
            receiverId: messageToEmit.receiverId,
          });
        }

      } catch (err) {
        console.error('Error sending message:', err.message);
        socket.emit('chat_error', 'Failed to send message.');
      }
    });

    // Handle 'update_message_read_status' event
    socket.on('update_message_read_status', async (messageId) => {
      try {
        const message = await Message.findById(messageId);
        if (message && !message.readStatus) { // Only update if not already read
          message.readStatus = Date.now();
          await message.save();
          console.log(`Message ${messageId} read status updated.`);
          // Optionally, broadcast this update to the room so sender sees 'read' status
          const sender = await User.findById(message.senderId);
          const receiver = await User.findById(message.receiverId);
          const participants = [sender._id.toString(), receiver._id.toString()].sort();
          const roomId = participants.join('_');

          io.to(roomId).emit('message_read', {
            messageId: message._id.toString(),
            readStatus: message.readStatus.toISOString(),
          });
        }
      } catch (err) {
        console.error('Error updating message read status:', err.message);
      }
    });

    // Handle 'delete_message' event
    socket.on('delete_message', async (messageId) => {
      try {
        const message = await Message.findById(messageId);
        if (message && message.senderId.toString() === socket.userId) { // Only sender can delete
          await Message.deleteOne({ _id: messageId });
          console.log(`Message ${messageId} deleted.`);
          // Broadcast deletion to the room
          const sender = await User.findById(message.senderId);
          const receiver = await User.findById(message.receiverId);
          const participants = [sender._id.toString(), receiver._id.toString()].sort();
          const roomId = participants.join('_');

          io.to(roomId).emit('message_deleted', { messageId: message._id.toString() });
        } else {
          socket.emit('chat_error', 'You are not authorized to delete this message.');
        }
      } catch (err) {
        console.error('Error deleting message:', err.message);
        socket.emit('chat_error', 'Failed to delete message.');
      }
    });

    // Handle 'update_message' event (for editing text messages)
    socket.on('update_message', async (data) => {
      const { messageId, newContent } = data;
      try {
        const message = await Message.findById(messageId);
        if (message && message.senderId.toString() === socket.userId && message.type === 'text') { // Only sender can edit text messages
          message.content = newContent;
          await message.save();
          console.log(`Message ${messageId} updated to: ${newContent}`);
          // Broadcast update to the room
          const sender = await User.findById(message.senderId);
          const receiver = await User.findById(message.receiverId);
          const participants = [sender._id.toString(), receiver._id.toString()].sort();
          const roomId = participants.join('_');

          io.to(roomId).emit('message_updated', {
            messageId: message._id.toString(),
            newContent: message.content,
            timestamp: message.timestamp.toISOString(), // Send original timestamp or updated if desired
          });
        } else {
          socket.emit('chat_error', 'You are not authorized to edit this message or it is not a text message.');
        }
      } catch (err) {
        console.error('Error updating message:', err.message);
        socket.emit('chat_error', 'Failed to update message.');
      }
    });


    // Handle disconnection
    socket.on('disconnect', async (reason) => {
      console.log(`User disconnected: ${socket.fullName} (ID: ${socket.userId}) - Reason: ${reason}`);
      // Update user's online status and last active time on disconnect
      try {
        await User.findByIdAndUpdate(
          socket.userId,
          { isOnline: false, lastActive: Date.now() },
          { new: true }
        );
        console.log(`User ${socket.fullName} set to offline.`);
      } catch (err) {
        console.error(`Error updating online status for ${socket.userId} on disconnect:`, err.message);
      }
    });
  });
};
