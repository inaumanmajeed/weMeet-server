import { connectToDatabase } from './src/db/index.js';
import { PORT } from './constants.js';
import { app } from './src/app.js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { setupSocketHandlers } from './src/services/socketHandlers.js';

connectToDatabase()
  .then(() => {
    const server = createServer(app);
    const io = new Server(server, {
      cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    // Setup socket handlers
    setupSocketHandlers(io);

    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });

    // Graceful shutdown handlers
    const gracefulShutdown = (signal) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      server.close(() => {
        console.log('Server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGUSR2', gracefulShutdown);
  })
  .catch((error) => {
    console.error('Error connecting to the database:', error);
    process.exit(1);
  });
