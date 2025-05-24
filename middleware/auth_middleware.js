// middleware/auth_middleware.js
// Middleware to verify JWT tokens for protected routes.

const jwt = require('jsonwebtoken'); // For verifying JSON Web Tokens

// Middleware function
module.exports = function (req, res, next) {
  // Get token from header
  const token = req.header('Authorization');

  // Check if no token
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  // Expecting "Bearer TOKEN_STRING". Split and get the actual token.
  const tokenParts = token.split(' ');
  if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer') {
    return res.status(401).json({ message: 'Token format is "Bearer <token>"' });
  }
  const actualToken = tokenParts[1];

  try {
    // Verify token
    const decoded = jwt.verify(actualToken, process.env.JWT_SECRET);

    // Attach user information from the token payload to the request object
    // This makes user.id, user.username, and now user.fullName available in subsequent route handlers
    req.user = decoded.user; // decoded.user should now contain id, username, and fullName
    next(); // Move to the next middleware/route handler
  } catch (err) {
    // If token is not valid (e.g., expired, malformed)
    res.status(401).json({ message: 'Token is not valid' });
  }
};
