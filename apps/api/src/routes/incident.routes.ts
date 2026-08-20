import { Router } from "express";
import { pool } from "../config/database.js";
import { IncidentController } from "../controllers/incident.controller.js";
import { AuditRepository } from "../repositories/audit.repository.js";
import { IncidentRepository } from "../repositories/incident.repository.js";
import { IncidentService } from "../services/incident.service.js";

const router = Router();
const controller = new IncidentController(new IncidentService(new IncidentRepository(pool), new AuditRepository(pool)));

router.get("/", controller.list);
router.get("/:id", controller.get);
router.post("/", controller.create);
router.patch("/:id", controller.update);

export default router;
