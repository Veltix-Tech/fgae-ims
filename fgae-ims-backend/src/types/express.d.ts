
import "express";

declare global {
  namespace Express {
    interface Request {
      userId: string;
      auth?: {
        userId: string;
        sessionId: string;
      };
    }
  }
}

export {};
