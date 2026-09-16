import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * iOS rounds and masks home-screen icons itself, so this is full-bleed with
 * generous padding rather than the pre-rounded tile used elsewhere — a rounded
 * icon gets rounded twice and comes out pinched.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#c9f24d",
        }}
      >
        <svg width="112" height="112" viewBox="0 0 32 32">
          <path
            d="M 23.4 10.8 A 7.4 5.2 0 1 0 16 16 A 7.4 5.2 0 1 1 8.6 21.2"
            fill="none"
            stroke="#0a0b0d"
            strokeWidth="4.6"
            strokeLinecap="butt"
          />
        </svg>
      </div>
    ),
    size,
  );
}
