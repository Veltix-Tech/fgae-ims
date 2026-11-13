import express from 'express';
import type { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import prisma from './config/db.js';
import cookieParser from "cookie-parser";
import authRoutes from "./modules/auth/auth.routes.js";

dotenv.config();

const app: Application = express();
// ... rest of your code remains the same
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Authentication routes
app.use("/auth", authRoutes);

// Health Check Route
app.get('/health', async (req: Request, res: Response) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ 
      status: 'success', 
      message: 'FGAE-IMS Backend is running and connected to database' 
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: 'Database connection failed', 
      error: (error as Error).message 
    });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});