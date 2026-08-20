import { Router } from "express";
import { pool } from "../config/database.js";
import { UserController } from "../controllers/user.controller.js";
import { UserRepository } from "../repositories/user.repository.js";
import { UserService } from "../services/user.service.js";

const router = Router();
const controller = new UserController(new UserService(new UserRepository(pool)));

router.get("/", controller.list);
router.get("/:id", controller.get);
router.post("/", controller.create);
router.patch("/:id", controller.update);

export default router;
