import { prisma } from "../../config/prisma.js";

class ChatService {

  async sendMessage(senderId, receiverId, content) {
    return prisma.message.create({
      data: { senderId, receiverId, content },
    });
  }

  async getConversations(userId) {
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const map = new Map();

    for (const msg of messages) {
      const otherUserId =
        msg.senderId === userId ? msg.receiverId : msg.senderId;

      if (!map.has(otherUserId)) {
        const user = await prisma.user.findUnique({
          where: { id: otherUserId },
          select: {
            id: true,
            name: true,
            username: true,
          },
        });

        if (user) {
          map.set(otherUserId, {
            user,
            lastMessage: msg,
          });
        }
      }
    }

    return Array.from(map.values());
  }

  async getConversation(userId, otherUserId, after = null) {
    return prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
        ...(after && { createdAt: { gt: new Date(after) } }),
      },
      orderBy: { createdAt: "asc" }, // chat natural
    });
  }
}

export const chatService = new ChatService();
