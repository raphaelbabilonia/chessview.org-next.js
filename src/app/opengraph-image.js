import { ImageResponse } from "next/og";

export const alt = "ChessView global chess tournament search and chess news index";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

const squares = Array.from({ length: 64 }, (_, index) => {
  const row = Math.floor(index / 8);
  const col = index % 8;
  return {
    key: index,
    dark: (row + col) % 2 === 1,
  };
});

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#FAF9F5",
          color: "#032044",
          display: "flex",
          height: "100%",
          justifyContent: "space-between",
          padding: "64px 72px",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 680 }}>
          <div
            style={{
              alignItems: "center",
              display: "flex",
              fontSize: 38,
              fontWeight: 800,
              gap: 18,
            }}
          >
            <div
              style={{
                alignItems: "center",
                background: "#032044",
                borderRadius: 18,
                color: "#D8B95A",
                display: "flex",
                fontSize: 34,
                fontWeight: 900,
                height: 76,
                justifyContent: "center",
                width: 76,
              }}
            >
              CV
            </div>
            ChessView
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ color: "#165A4C", fontSize: 30, fontWeight: 800 }}>
              Global chess tournament search
            </div>
            <div style={{ color: "#1E3552", fontSize: 54, fontWeight: 900, lineHeight: 1.08 }}>
              Upcoming events, country coverage, chess news, and original organizer links.
            </div>
          </div>
          <div style={{ color: "#526070", fontSize: 26 }}>chessview.org</div>
        </div>
        <div
          style={{
            border: "10px solid #032044",
            boxShadow: "0 18px 0 #D8B95A",
            display: "flex",
            flexWrap: "wrap",
            height: 344,
            width: 344,
          }}
        >
          {squares.map((square) => (
            <div
              key={square.key}
              style={{
                background: square.dark ? "#165A4C" : "#F4EFD8",
                height: 40.5,
                width: 40.5,
              }}
            />
          ))}
        </div>
      </div>
    ),
    size
  );
}
