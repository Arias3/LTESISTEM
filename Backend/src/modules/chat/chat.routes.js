import { Router } from "express";
import { chatService } from "./chat.service.js";

const router = Router();

// Middleware simple para asegurar login
function requireAuth(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: "No autenticado" });
  }
  next();
}

/**
 * Enviar mensaje
 * POST /api/chat/send
 * body: { receiverId, content }
 */
router.post("/send", requireAuth, async (req, res) => {
  try {
    const senderId = req.session.user.id;
    const { receiverId, content } = req.body;

    if (!receiverId || !content) {
      return res.status(400).json({ error: "Datos incompletos" });
    }

    const msg = await chatService.sendMessage(senderId, receiverId, content);
    res.json(msg);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Obtener conversación con otro usuario
 * GET /api/chat/conversation/:otherUserId
 * opcional query: ?lastMessageId=xxxx
 */
router.get("/conversation/:otherUserId", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const otherUserId = req.params.otherUserId;
    const lastMessageId = req.query.lastMessageId || null;

    const messages = await chatService.getConversation(
      userId,
      otherUserId,
      lastMessageId
    );

    res.json(messages);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Últimos mensajes del usuario
 * GET /api/chat/last
 */
router.get("/last", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const messages = await chatService.getLastMessages(userId);
    res.json(messages);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
