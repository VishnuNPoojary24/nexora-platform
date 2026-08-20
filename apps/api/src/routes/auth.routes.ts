import { Router } from "express";
import { pool } from "../config/database.js";
import { requireAuth } from "../middleware/auth.js";
import { AuthController } from "../controllers/auth.controller.js";
import { AuthRepository } from "../repositories/auth.repository.js";
import { AuthService } from "../services/auth.service.js";

const router = Router();
const controller = new AuthController(new AuthService(new AuthRepository(pool)));

router.post("/bootstrap-company", controller.bootstrapCompany);
router.post("/register", controller.registerUser);
router.post("/login", controller.login);
router.get("/me", requireAuth, controller.me);

export default router;