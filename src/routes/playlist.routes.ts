import { Router } from "express";
import * as playlistController from "../controllers/playlist.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// Public route — no auth required (must be defined before router.use(authenticate))
router.get("/share/:token", playlistController.getPublicPlaylist);

router.use(authenticate);

router.get("/", playlistController.getPlaylists);
router.post("/", playlistController.createPlaylist);
router.patch("/:id", playlistController.updatePlaylist);
router.delete("/:id", playlistController.deletePlaylist);
router.delete("/:id/leave", playlistController.leavePlaylist);
router.get("/:id/songs", playlistController.getPlaylistSongs);
router.post("/add-song", playlistController.addSong);
router.get("/invites/pending", playlistController.getPendingInvites);
router.patch("/:id/collaborators/respond", playlistController.respondToInvite);
router.get("/:id/collaborators", playlistController.getCollaborators);
router.post("/:id/collaborators", playlistController.addCollaborator);
router.delete("/:id/collaborators/:userId", playlistController.removeCollaborator);
router.post("/:id/share-token", playlistController.generateShareToken);
router.post("/:id/share-email", playlistController.sendShareEmail);

export default router;
