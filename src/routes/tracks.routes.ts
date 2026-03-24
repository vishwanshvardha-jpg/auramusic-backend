import { Router } from "express";
import * as tracksController from "../controllers/tracks.controller.js";

const router = Router();

router.get("/lookup", tracksController.lookupTracks);

export default router;
