import { Router } from "express";
import incidentRoutes from "./incident.routes.js";
import teamRoutes from "./team.routes.js";
import userRoutes from "./user.routes.js";

const router = Router();

router.use("/incidents", incidentRoutes);
router.use("/teams", teamRoutes);
router.use("/users", userRoutes);

export default router;
