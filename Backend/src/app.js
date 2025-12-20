import express from "express";
import cors from "cors";
import routes from "./routes.js";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import session from "express-session";

dotenv.config();

export const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "privado-lte",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // true solo si usas HTTPS
      maxAge: 1000 * 60 * 60 * 2 // 2 horas
    }
  })
);
app.use("/api", routes);

app.get("/", (req,res)=> res.send("Backend funcionando 🚀"));

export default app;
