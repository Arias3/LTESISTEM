import { prisma } from "../../config/prisma.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || "default-secret"; // Use env var in production
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";

export async function getUsers() {
  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      createdAt: true
    }
  });
}

export async function getUserById(id) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      createdAt: true
    }
  });
}

export async function createUser({ name, username, password, role }) {
  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) throw new Error("Este usuario ya existe");

  const hashed = await bcrypt.hash(password, SALT_ROUNDS);

  return prisma.user.create({
    data: { name, username, password: hashed, role },
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      createdAt: true
    }
  });
}

export async function updateUser(id, data) {
  const payload = { ...data };

  if (payload.password) {
    payload.password = await bcrypt.hash(payload.password, SALT_ROUNDS);
  }

  return prisma.user.update({
    where: { id },
    data: payload,
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      createdAt: true
    }
  });
}

export async function deleteUser(id) {
  return prisma.user.delete({ where: { id } });
}

export async function loginBasic({ username, password }) {
  if (!username || !password) throw new Error("Credenciales incompletas");

  const user = await prisma.user.findUnique({
    where: { username }
  });

  if (!user) throw new Error("Usuario no encontrado");

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new Error("Contraseña incorrecta");

  // Generate JWT token
  const token = jwt.sign(
    {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return {
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role
    },
    token
  };
}

export async function logout(req) {
  return new Promise((resolve, reject) => {
    if (!req.session) return resolve(); // No había sesión

    req.session.destroy(err => {
      if (err) reject(new Error("No se pudo cerrar sesión"));
      else resolve();
    });
  });
}
