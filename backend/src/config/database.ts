import mongo from 'mongoose';

export const connectDatabase = async () => {
  try {
    const connection = await mongo.connect(process.env.MONGODB_URI!);
    console.log('MongoDB connected:', connection.connection.host);
    return connection;
  } catch (e) {
    console.error('MongoDB connection error:', e);
    throw e;
  }
};
