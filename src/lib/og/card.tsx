import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";

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
          <svg width="44" height="44" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="7" fill="#c9f24d" />
            <path
              d="M 23.4 10.8 A 7.4 5.2 0 1 0 16 16 A 7.4 5.2 0 1 1 8.6 21.2"
              fill="none"
              stroke="#0a0b0d"
              strokeWidth="4.6"
              strokeLinecap="butt"
            />
          </svg>
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
