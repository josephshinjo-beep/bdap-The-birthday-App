// PWA icons drawn at request time (placeholder art until the real logo arrives).
import { ImageResponse } from "next/og";

const SIZES = new Set([180, 192, 512]);

export async function GET(_req: Request, ctx: RouteContext<"/icons/[size]">) {
  const { size: raw } = await ctx.params;
  const size = Number(raw);
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ff4f7b",
        }}
      >
        <div
          style={{
            width: size * 0.56,
            height: size * 0.5,
            background: "#ffd23f",
            borderRadius: size * 0.06,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <div style={{ position: "absolute", width: size * 0.1, height: "100%", background: "#221b3a" }} />
          <div style={{ position: "absolute", width: "100%", height: size * 0.1, background: "#221b3a" }} />
        </div>
      </div>
    ),
    { width: size, height: size, headers: { "cache-control": "public, max-age=604800, immutable" } },
  );
}
