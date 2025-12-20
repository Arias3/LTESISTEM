import { Router } from "express";
const router = Router();

router.get("/", (req,res)=> res.json({ msg: "Devices API ok" }));

export default router;
