import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { authenticateToken } from "../auth/middleware";
import { insertDispatchSessionSchema } from "@shared/schema";
import { randomUUID } from "crypto";

const router = Router();

const createSessionSchema = z.object({
  shipId: z.enum(['ship-a', 'ship-b', 'ship-c']),
  dispatchVersionId: z.number().optional(),
  spreadsheetSnapshot: z.any().optional(),
});

const updateSessionSchema = z.object({
  status: z.enum(['active', 'paused', 'completed']).optional(),
  dispatchVersionId: z.number().optional(),
  spreadsheetSnapshot: z.any().optional(),
  eodFilename: z.string().optional(),
  paxFilename: z.string().optional(),
});

router.post("/", authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const validatedData = createSessionSchema.parse(req.body);
    
    const existingSession = await storage.getActiveDispatchSession(user.id, validatedData.shipId);
    if (existingSession) {
      return res.status(409).json({ 
        message: "Active session already exists for this ship",
        existingSession 
      });
    }

    const sessionData = insertDispatchSessionSchema.parse({
      id: randomUUID(),
      userId: user.id,
      shipId: validatedData.shipId,
      status: 'active',
      dispatchVersionId: validatedData.dispatchVersionId,
      spreadsheetSnapshot: validatedData.spreadsheetSnapshot,
    });

    const session = await storage.createDispatchSession(sessionData);
    
    res.status(201).json({ session });
  } catch (error) {
    console.error("Error creating dispatch session:", error);
    res.status(500).json({ message: "Failed to create dispatch session" });
  }
});

router.get("/:sessionId", authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const { sessionId } = req.params;
    const session = await storage.getDispatchSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    if (session.userId !== user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json({ session });
  } catch (error) {
    console.error("Error fetching dispatch session:", error);
    res.status(500).json({ message: "Failed to fetch dispatch session" });
  }
});

router.patch("/:sessionId", authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const { sessionId } = req.params;
    const validatedData = updateSessionSchema.parse(req.body);
    
    const existingSession = await storage.getDispatchSession(sessionId);
    if (!existingSession) {
      return res.status(404).json({ message: "Session not found" });
    }
    
    if (existingSession.userId !== user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const updatedSession = await storage.updateDispatchSession(sessionId, validatedData);
    
    res.json({ session: updatedSession });
  } catch (error) {
    console.error("Error updating dispatch session:", error);
    res.status(500).json({ message: "Failed to update dispatch session" });
  }
});

router.get("/active/:shipId", authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const { shipId } = req.params;
    
    if (!['ship-a', 'ship-b', 'ship-c'].includes(shipId)) {
      return res.status(400).json({ message: "Invalid ship ID" });
    }

    const session = await storage.getActiveDispatchSession(user.id, shipId);
    
    res.json({ session: session || null });
  } catch (error) {
    console.error("Error fetching active session:", error);
    res.status(500).json({ message: "Failed to fetch active session" });
  }
});

router.get("/", authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const limit = parseInt(req.query.limit as string) || 10;
    const sessions = await storage.getUserDispatchSessions(user.id, limit);
    
    res.json({ sessions });
  } catch (error) {
    console.error("Error fetching user sessions:", error);
    res.status(500).json({ message: "Failed to fetch user sessions" });
  }
});

router.post("/:sessionId/close", authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const { sessionId } = req.params;
    
    const existingSession = await storage.getDispatchSession(sessionId);
    if (!existingSession) {
      return res.status(404).json({ message: "Session not found" });
    }
    
    if (existingSession.userId !== user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const closedSession = await storage.closeDispatchSession(sessionId);
    
    res.json({ session: closedSession });
  } catch (error) {
    console.error("Error closing dispatch session:", error);
    res.status(500).json({ message: "Failed to close dispatch session" });
  }
});

export default router;
