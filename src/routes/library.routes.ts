import { Router } from "express";
import * as libraryController from "../controllers/library.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// All library routes are protected
router.use(authenticate);

router.get("/liked", libraryController.getLikedSongs);
router.post("/toggle-like", libraryController.toggleLike);

export default router;
