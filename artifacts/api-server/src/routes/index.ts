import { Router, type IRouter } from "express";
import healthRouter from "./health";
import settingsRouter from "./settings";
import conversationsRouter from "./conversations";
import chatRouter from "./chat";
import transcribeRouter from "./transcribe";
import ttsRouter from "./tts";
import commandsRouter from "./commands";
import statsRouter from "./stats";
import { autonomousRouter } from "./autonomous";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(settingsRouter);
router.use(conversationsRouter);
router.use(chatRouter);
router.use(transcribeRouter);
router.use(ttsRouter);
router.use(commandsRouter);
router.use(statsRouter);
router.use("/autonomous", autonomousRouter);
router.use("/auth", authRouter);

export default router;
