import { getOrSetVisitorId, isPro } from "../../lib/cookies";
import { getFreeUsageStatus } from "../../lib/rateLimit";

export default async function handler(req, res) {
  try {
    const trId = getOrSetVisitorId(req, res);
    const pro = isPro(req);

    if (pro) {
      res.status(200).json({ mode: "pro", remaining: null, limit: null, storage: "n/a" });
      return;
    }

    const st = await getFreeUsageStatus(trId);
    res.status(200).json({ mode: "free", ...st });
  } catch (e) {
    res.status(200).json({ mode: "free", remaining: 3, limit: 3, storage: "unknown" });
  }
}
