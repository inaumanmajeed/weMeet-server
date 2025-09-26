import mongoose from 'mongoose';
import { MONGO_URI, DB_NAME } from '../../constants.js';

export const connectToDatabase = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      `${MONGO_URI}/${DB_NAME}`
    );
    console.log(
      `</> Connected to the database: ${connectionInstance.connection.host}:${connectionInstance.connection.port}/${DB_NAME}`
    );
  } catch (error) {
    console.error('Error connecting to the database:', error);
    process.exit(1);
  }
};
