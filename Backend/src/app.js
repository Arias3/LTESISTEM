import express from "express";
import cors from "cors";
import routes from "./routes.js";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import session from "express-session";
import http from "http";
import { Server } from "socket.io";
import initCallGateway from "./modules/call/call.gateway.js";

/* ================= ENV ================= */
dotenv.config();

/* ================= APP & PRISMA ================= */
export const prisma = new PrismaClient();
const app = express();

/* ================= MIDDLEWARE ================= */
app.use(
  cors({
    origin: true,
    credentials: true
  })
);

app.use(express.json());

app.use(
  session({
    name: "ltesistemsessionid",
    secret: process.env.SESSION_SECRET || "privado-lte",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // true solo en https
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

/* ================= ROUTES ================= */
app.use("/api", routes);
app.get("/", (req, res) => res.send("Backend funcionando 🚀"));

/* ================= HTTP SERVER ================= */
const server = http.createServer(app);

/* ================= SOCKET.IO ================= */
const io = new Server(server, {
  cors: {
    origin: "*",
    credentials: true
  }
});

/* ================= CALL GATEWAY ================= */
initCallGateway(io);

export { app, server };
