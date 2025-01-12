import express from "express";
import StorageRouter from "./storageRouter.mjs";

const router = express.Router();

router.get("/on", (req, res) => {
  res.status(200).json({ status: "ok" });
});

router.use("/storage", StorageRouter);

export default router;
