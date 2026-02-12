import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "default-secret"; // Use env var in production

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const token = authHeader.substring(7); // Remove "Bearer "

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // 🔹 guardar info completa del usuario
    console.log('Decoded token:', decoded);
    next();
  } catch (err) {
    console.log('Token verification error:', err);
    return res.status(401).json({ error: "Token inválido" });
  }
}
