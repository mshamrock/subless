import { ImageResponse } from "next/og";
import { SWAN_DATA_URI } from "@/lib/og/swan";

export const size = { width: 128, height: 128 };
export const contentType = "image/png";

/**
 * The mark sits on a dark rounded tile rather than on transparency: browser tab
 * strips are usually light, and lime on white is close to invisible at 16px.
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0b0d",
          borderRadius: 28,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={SWAN_DATA_URI} width={96} height={96} alt="" />
      </div>
    ),
    size,
  );
}
