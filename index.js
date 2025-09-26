import dotenv from 'dotenv';
// dotenv.config({ path: './.env' });
dotenv.config();
import { connectToDatabase } from './src/db/index.js';
import { PORT } from './constants.js';
import { app } from './src/app.js';

connectToDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Error connecting to the database:', error);
    process.exit(1);
  });
