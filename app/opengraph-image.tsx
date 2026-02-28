import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630
};

export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          backgroundColor: "#f8faff",
          color: "#0f172a",
          padding: 60
        }}
      >
        <div
          style={{
            border: "2px solid rgba(99,102,241,0.25)",
            borderRadius: 999,
            color: "#4338ca",
            fontSize: 34,
            fontWeight: 600,
            letterSpacing: "0.08em",
            marginBottom: 20,
            padding: "10px 24px",
            textTransform: "uppercase"
          }}
        >
          Bike Me
        </div>
        <div
          style={{
            fontSize: 76,
            fontWeight: 700,
            letterSpacing: "-0.04em",
            lineHeight: 1.05,
            textAlign: "center",
            maxWidth: 960
          }}
        >
          Find rides. Join fast. Ride together.
        </div>
      </div>
    ),
    {
      ...size
    }
  );
}
