import { Router, type IRouter } from "express";
import healthRouter from "./health";
import limitApplicationsRouter from "./limit-applications";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(limitApplicationsRouter);
router.use(storageRouter);

export default router;
