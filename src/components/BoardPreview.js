const pieces = ["r", "n", "b", "q", "k", "b", "n", "r", "p", "p", "p", "p", "p", "p", "p", "p"];

const pieceMap = {
  r: "R",
  n: "N",
  b: "B",
  q: "Q",
  k: "K",
  p: "",
};

export function BoardPreview() {
  const squares = Array.from({ length: 64 }, (_, index) => {
    const row = Math.floor(index / 8);
    const col = index % 8;
    const dark = (row + col) % 2 === 1;
    let piece = "";
    if (row < 2) piece = pieceMap[pieces[index]];
    if (row > 5) piece = pieceMap[pieces[63 - index]];
    return (
      <span className={dark ? "board-square dark" : "board-square"} key={index}>
        {piece}
      </span>
    );
  });

  return (
    <div className="board-visual" aria-hidden="true">
      {squares}
    </div>
  );
}
