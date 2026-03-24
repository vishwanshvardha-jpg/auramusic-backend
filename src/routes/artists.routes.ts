import { Router } from "express";
import * as artistsController from "../controllers/artists.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/", artistsController.getFollowedArtists);
router.post("/toggle", artistsController.toggleFollow);

export default router;
