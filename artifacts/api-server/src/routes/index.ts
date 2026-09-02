import { Router, type IRouter } from "express";
import healthRouter from "./health";
import limitApplicationsRouter from "./limit-applications";

const router: IRouter = Router();

router.use(healthRouter);
router.use(limitApplicationsRouter);

export default router;
