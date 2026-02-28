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
          alignItems: "center",
          background:
            "radial-gradient(circle at 20% 20%, rgba(79,70,229,0.55), rgba(248,250,255,1) 48%), radial-gradient(circle at 85% 15%, rgba(14,165,233,0.32), rgba(248,250,255,0.9) 45%), #f8faff",
          color: "#0f172a",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "center",
          width: "100%"
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
            width: 960
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
