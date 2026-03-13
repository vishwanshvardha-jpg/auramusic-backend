import { Router } from "express";
import * as musicController from "../controllers/music.controller.js";

const router = Router();

router.get("/search", musicController.searchMusic);

export default router;
