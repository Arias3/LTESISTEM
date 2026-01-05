import { Router } from "express";
import { chatService } from "./chat.service.js";
import { prisma } from "../../config/prisma.js";

const router = Router();

function requireAuth(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: "No autenticado" });
  }
  next();
}

/* ================= SEND ================= */
router.post("/send", requireAuth, async (req, res) => {
  const { receiverId, content } = req.body;
  const senderId = req.session.user.id;

  try {
    const msg = await chatService.sendMessage(senderId, receiverId, content);
    res.json(msg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al enviar mensaje" });
  }
});

/* ================= CONVERSATIONS LIST ================= */
router.get("/conversations", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const conversations = await chatService.getConversations(userId);
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= SINGLE CONVERSATION ================= */
router.get("/conversation/:otherUserId", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { otherUserId } = req.params;
    const { after } = req.query;

    const messages = await chatService.getConversation(
      userId,
      otherUserId,
      after || null
    );

    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener mensajes" });
  }
});

export default router;
