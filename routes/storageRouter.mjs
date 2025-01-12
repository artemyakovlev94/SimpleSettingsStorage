import express from "express";
const router = express.Router();
import {
  verifySignatureGitHub,
  verifyAccessToken,
} from "../middleware/authMiddleware.mjs";
import {
  getScheme,
  getFiles,
  webhookRepo,
  syncRepo,
} from "../controllers/storageController.mjs";

router.get("/scheme", getScheme);
router.get("/files", getFiles);
router.post("/repo/webhook", verifySignatureGitHub, webhookRepo);
router.post("/repo/sync", verifyAccessToken, syncRepo);

export default router;
