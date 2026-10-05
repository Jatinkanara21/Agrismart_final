import { Router, type IRouter } from "express";
import { ListMarketPricesQueryParams } from "@workspace/api-zod";
import { requireDbUser } from "../lib/auth";
import { fetchOfficialMarketPrices } from "../lib/gov-market-prices";

const router: IRouter = Router();

router.get("/market-prices", requireDbUser, async (req, res): Promise<void> => {
  const params = ListMarketPricesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const feed = await fetchOfficialMarketPrices({
    ...params.data,
    date: params.data.date?.toISOString().slice(0, 10),
  });
  if (feed.status === "unavailable") {
    req.log.warn({ source: feed.source }, "Official mandi price feed unavailable");
  }
  res.json(feed);
});

export default router;