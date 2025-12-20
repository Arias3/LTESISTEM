import express from "express";
import cors from "cors";
import routes from "./routes.js";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

export const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());
app.use("/api", routes);

app.get("/", (req,res)=> res.send("Backend funcionando 🚀"));

export default app;
