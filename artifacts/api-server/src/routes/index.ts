import { Router, type IRouter } from "express";
import healthRouter from "./health";
import settingsRouter from "./settings";
import conversationsRouter from "./conversations";
import chatRouter from "./chat";
import transcribeRouter from "./transcribe";
import commandsRouter from "./commands";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(settingsRouter);
router.use(conversationsRouter);
router.use(chatRouter);
router.use(transcribeRouter);
router.use(commandsRouter);
router.use(statsRouter);

export default router;
