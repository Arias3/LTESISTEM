import { prisma } from "../../config/prisma.js";

class ChatService {

  async sendMessage(senderId, receiverId, content) {
    return prisma.message.create({
      data: { senderId, receiverId, content }
    });
  }

  async getConversation(userId, otherUserId, lastMessageId = null) {

    const whereQuery = lastMessageId
      ? {
          OR: [
            { senderId: userId, receiverId: otherUserId },
            { senderId: otherUserId, receiverId: userId }
          ],
          id: { gt: lastMessageId }
        }
      : {
          OR: [
            { senderId: userId, receiverId: otherUserId },
            { senderId: otherUserId, receiverId: userId }
          ]
        };

    return prisma.message.findMany({
      where: whereQuery,
      orderBy: { createdAt: "asc" },
      take: 50   // Importante para no matar el backend
    });
  }

  async getLastMessages(userId) {
    return prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId }
        ]
      },
      orderBy: { createdAt: "desc" },
      take: 30
    });
  }

}

export const chatService = new ChatService();
