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
          position: "relative",
          backgroundColor: "#060b16",
          color: "#edf1ff",
          padding: 56
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 420,
            height: 420,
            borderRadius: 999,
            left: -120,
            top: -100,
            backgroundColor: "rgba(86, 112, 214, 0.35)"
          }}
        />

        <div
          style={{
            position: "absolute",
            width: 360,
            height: 360,
            borderRadius: 999,
            right: -80,
            bottom: -120,
            backgroundColor: "rgba(128, 39, 130, 0.28)"
          }}
        />

        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 36,
            border: "1px solid rgba(179, 197, 255, 0.28)",
            backgroundColor: "rgba(8, 15, 31, 0.88)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
            padding: "56px 72px"
          }}
        >
          <div
            style={{
              border: "1px solid rgba(151, 177, 255, 0.5)",
              borderRadius: 999,
              color: "#c2d4ff",
              fontSize: 29,
              fontWeight: 600,
              letterSpacing: "0.08em",
              marginBottom: 24,
              padding: "10px 22px",
              textTransform: "uppercase"
            }}
          >
            Bike ME
          </div>

          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              letterSpacing: "-0.04em",
              lineHeight: 1.02,
              maxWidth: 980,
              color: "#edf1ff"
            }}
          >
            Find rides. Join fast. Ride together.
          </div>
        </div>
      </div>
    ),
    {
      ...size
    }
  );
}
