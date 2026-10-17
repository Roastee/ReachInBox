import { ExpressAdapter } from "@bull-board/express";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { Router } from "express";
import { emailQueue, notificationQueue } from "../queues/queues";
import { requireAuth } from "../middleware/auth";

export function bullBoardRouter(): Router {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/admin/queues");
  createBullBoard({
    queues: [new BullMQAdapter(emailQueue), new BullMQAdapter(notificationQueue)],
    serverAdapter,
  });

  const router = Router();
  router.use(requireAuth, serverAdapter.getRouter());
  return router;
}
