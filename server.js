const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Route
app.get('/', (req, res) => {
  res.send('Interactive Whiteboard Server is running');
});

// Store whiteboard data for each room
const whiteboardData = {};

// Socket.io connection
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join a room
  socket.on('joinRoom', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room: ${roomId}`);
    
    // Initialize room data if not exists
    if (!whiteboardData[roomId]) {
      whiteboardData[roomId] = {
        lines: [],
        users: {}
      };
    }
    
    // Add user to room's users
    whiteboardData[roomId].users[socket.id] = {
      id: socket.id,
      color: getRandomColor(),
      name: `User ${Object.keys(whiteboardData[roomId].users).length + 1}`,
      position: { x: 0, y: 0 }
    };
    
    // Send current whiteboard data to the new user
    socket.emit('currentWhiteboard', whiteboardData[roomId]);
    
    // Broadcast user joined to others in the room
    io.to(roomId).emit('userJoined', whiteboardData[roomId].users[socket.id]);
  });
  
  // Drawing event
  socket.on('draw', (data) => {
    const { roomId, line } = data;
    
    // Save line to whiteboard data
    if (whiteboardData[roomId]) {
      whiteboardData[roomId].lines.push(line);
      
      // Broadcast draw event to everyone in the room except the sender
      socket.to(roomId).emit('draw', line);
    }
  });
  
  // Clear whiteboard event
  socket.on('clearWhiteboard', (roomId) => {
    if (whiteboardData[roomId]) {
      whiteboardData[roomId].lines = [];
      
      // Broadcast clear event to everyone in the room
      io.to(roomId).emit('whiteboardCleared');
    }
  });
  
  // User cursor position update
  socket.on('cursorPosition', (data) => {
    const { roomId, position } = data;
    
    if (whiteboardData[roomId] && whiteboardData[roomId].users[socket.id]) {
      whiteboardData[roomId].users[socket.id].position = position;
      
      // Broadcast cursor position to everyone in the room except the sender
      socket.to(roomId).emit('userCursorPosition', {
        userId: socket.id,
        position
      });
    }
  });
  
  // Disconnect event
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Remove user from all rooms they were part of
    for (const roomId in whiteboardData) {
      if (whiteboardData[roomId].users[socket.id]) {
        delete whiteboardData[roomId].users[socket.id];
        
        // Broadcast user left to others in the room
        io.to(roomId).emit('userLeft', socket.id);
        
        // Remove room if empty
        if (Object.keys(whiteboardData[roomId].users).length === 0) {
          delete whiteboardData[roomId];
        }
      }
    }
  });
});

// Generate random color for users
function getRandomColor() {
  const colors = [
    '#FF6633', '#FFB399', '#FF33FF', '#FFFF99', '#00B3E6', 
    '#E6B333', '#3366E6', '#999966', '#99FF99', '#B34D4D',
    '#80B300', '#809900', '#E6B3B3', '#6680B3', '#66991A', 
    '#FF99E6', '#CCFF1A', '#FF1A66', '#E6331A', '#33FFCC',
    '#66994D', '#B366CC', '#4D8000', '#B33300', '#CC80CC', 
    '#66664D', '#991AFF', '#E666FF', '#4DB3FF', '#1AB399'
  ];
  
  return colors[Math.floor(Math.random() * colors.length)];
}

// Start server
const PORT = process.env.PORT || 5002;
server.listen(PORT, () => {
  console.log(`Interactive Whiteboard Server running on port ${PORT}`);
}); 