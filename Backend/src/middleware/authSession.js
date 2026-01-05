export function requireAuth(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: "No autorizado" });
  }
  req.user = req.session.user; // 🔹 guardar info completa
  next();
}
