
import express, {
  type Application,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import prisma from "./config/db.js";
import authRoutes from "./modules/auth/auth.routes.js";
import errorHandler from "./middleware/errorHandler.js";

const app: Application = express();

// Global middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Authentication routes
app.use("/auth", authRoutes);

// Health check
app.get(
  "/health",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      await prisma.$queryRaw`SELECT 1`;

      res.status(200).json({
        status: "success",
        message: "FGAE-IMS Backend is running and connected to database",
      });
    } catch (error) {
      next(error);
    }
  }
);

// Error handler must come after all routes
app.use(errorHandler);

export default app;
