const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const users = {};

io.on('connection', socket => {
  console.log('User connected:', socket.id);

  socket.on('join room', () => {
    users[socket.id] = socket.id;
    const otherUser = Object.keys(users).find(id => id !== socket.id);
    if (otherUser) {
      socket.emit('other user', otherUser);
      socket.to(otherUser).emit('user joined', socket.id);
    }
  });

  socket.on('offer', payload => {
    io.to(payload.target).emit('offer', payload);
  });

  socket.on('answer', payload => {
    io.to(payload.target).emit('answer', payload);
  });

  socket.on('ice-candidate', payload => {
    io.to(payload.target).emit('ice-candidate', payload);
  });

  socket.on('disconnect', () => {
    delete users[socket.id];
    console.log('User disconnected:', socket.id);
  });
});

// Simulación de usuario cada 10 segundos
setInterval(() => {
  const simulatedUser = `simulated-${Date.now()}`;
  users[simulatedUser] = simulatedUser;
  io.emit('user joined', simulatedUser);
  setTimeout(() => {
    delete users[simulatedUser];
    io.emit('user left', simulatedUser);
  }, 30000); // Simulación de desconexión después de 30 segundos
}, 10000);

server.listen(4000, () => console.log('Server is running on port 4000'));
