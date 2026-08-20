import { Router } from "express";
import incidentRoutes from "./incident.routes.js";
import teamRoutes from "./team.routes.js";
import userRoutes from "./user.routes.js";
import authRoutes from "./auth.routes.js";

const router = Router();

router.use("/incidents", incidentRoutes);
router.use("/teams", teamRoutes);
router.use("/users", userRoutes);
router.use("/auth", authRoutes);

export default router;
