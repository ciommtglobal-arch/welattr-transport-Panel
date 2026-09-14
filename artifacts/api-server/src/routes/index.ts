import { Router, type IRouter } from "express";
import healthRouter from "./health";
import limitApplicationsRouter from "./limit-applications";
import storageRouter from "./storage";
import tamiPaymentsRouter from "./tami-payments";

const router: IRouter = Router();

router.use(healthRouter);
router.use(limitApplicationsRouter);
router.use(storageRouter);
router.use(tamiPaymentsRouter);

export default router;
