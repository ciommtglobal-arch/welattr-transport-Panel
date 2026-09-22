import { Router, type IRouter } from "express";
import healthRouter from "./health";
import limitApplicationsRouter from "./limit-applications";
import storageRouter from "./storage";
import tamiPaymentsRouter from "./tami-payments";
import b2bListingsRouter from "./b2b-listings";
import b2bBusinessProfilesRouter from "./b2b-business-profiles";
import b2bReportsRouter from "./b2b-reports";
import b2bRequestsRouter from "./b2b-requests";
import mediaRouter from "./media";
import storefrontRouter from "./storefront";

const router: IRouter = Router();

router.use(healthRouter);
router.use(limitApplicationsRouter);
router.use(storageRouter);
router.use(tamiPaymentsRouter);
router.use(b2bListingsRouter);
router.use(b2bBusinessProfilesRouter);
router.use(b2bReportsRouter);
router.use(b2bRequestsRouter);
router.use(mediaRouter);
router.use(storefrontRouter);

export default router;
