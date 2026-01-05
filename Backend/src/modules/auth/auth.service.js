import { prisma } from "../../app.js";
import bcrypt from "bcryptjs";


const SALT_ROUNDS = 10;

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

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role
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
