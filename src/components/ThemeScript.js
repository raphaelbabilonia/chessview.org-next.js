import Script from "next/script";

export function ThemeScript() {
  const code = `
    (function () {
      try {
        var stored = localStorage.getItem("chessview_theme");
        var theme = stored || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
        document.documentElement.dataset.theme = theme;
      } catch (error) {}
    })();
  `;

  return <Script id="chessview-theme" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: code }} />;
}
