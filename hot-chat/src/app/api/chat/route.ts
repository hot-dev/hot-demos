import { HotClient } from "@hot-dev/sdk";
import { createHotProxyRoute } from "@hot-dev/sdk/proxy";

const hot = new HotClient({
  baseUrl: process.env.HOT_API_URL || "http://localhost:4681",
  token: process.env.HOT_API_KEY ?? "",
});

export const POST = createHotProxyRoute(hot, {
  onMissingToken: () =>
    new Response(
      JSON.stringify({
        error:
          "HOT_API_KEY is not set. Create a service key in the Hot App (Service Keys → New) and add HOT_API_KEY to .env.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    ),
});
