import { Router } from "express";
import * as playlistController from "../controllers/playlist.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/", playlistController.getPlaylists);
router.post("/", playlistController.createPlaylist);
router.delete("/:id", playlistController.deletePlaylist);
router.get("/:id/songs", playlistController.getPlaylistSongs);
router.post("/add-song", playlistController.addSong);
router.get("/:id/collaborators", playlistController.getCollaborators);
router.post("/:id/collaborators", playlistController.addCollaborator);
router.delete("/:id/collaborators/:userId", playlistController.removeCollaborator);

export default router;
