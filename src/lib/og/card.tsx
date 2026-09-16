import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";
import { SWAN_DATA_URI } from "./swan";

export const OG_SIZE = { width: 1200, height: 630 };

/**
 * One shared card so every shared link looks like the same product.
 *
 * Built with plain elements and system fonts rather than a font fetch: an OG
 * route that reaches out to a font CDN on every render is a slow path that fails
 * silently, and a missing preview image is worse than a plain one.
 */
export function ogCard({
  eyebrow,
  title,
  subtitle,
  figure,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  figure?: string;
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a0b0d",
          padding: 72,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={SWAN_DATA_URI} width={48} height={48} alt="" />
          <div style={{ color: "#8a919d", fontSize: 24, letterSpacing: 2 }}>
            {eyebrow.toUpperCase()}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {figure && (
            <div style={{ color: "#c9f24d", fontSize: 76, fontWeight: 700 }}>{figure}</div>
          )}
          <div
            style={{
              color: "#e9ebef",
              fontSize: title.length > 40 ? 62 : 78,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: -2,
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div style={{ color: "#8a919d", fontSize: 30, lineHeight: 1.3 }}>{subtitle}</div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24 }}>
          {/* The promise, not the tagline — the tagline is often the title above,
              and a card that says the same line twice looks like a template bug */}
          <span style={{ color: "#e9ebef" }}>{BRAND.promise}</span>
          <span style={{ color: "#5d636e" }}>{BRAND.domain}</span>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
