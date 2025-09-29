import { connectToDatabase } from './src/db/index.js';
import { PORT } from './constants.js';
import { app } from './src/app.js';

connectToDatabase()
  .then(() => {
    const server = app.listen(PORT, () => {
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
