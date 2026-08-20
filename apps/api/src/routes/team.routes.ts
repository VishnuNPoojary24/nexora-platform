import { Router } from "express";
import { pool } from "../config/database.js";
import { TeamController } from "../controllers/team.controller.js";
import { TeamRepository } from "../repositories/team.repository.js";
import { TeamService } from "../services/team.service.js";

const router = Router();
const controller = new TeamController(new TeamService(new TeamRepository(pool)));

router.get("/", controller.list);
router.get("/:id", controller.get);
router.post("/", controller.create);
router.patch("/:id", controller.update);

export default router;
