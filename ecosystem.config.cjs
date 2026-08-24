module.exports = {
  apps: [
    {
      name: "chessview-web",
      script: "server.js",
      cwd: "/home/chessview/htdocs/chessview.org",
      interpreter: "/opt/chessview/runtimes/node/24/bin/node",
      instances: 1,
      exec_mode: "fork",
      kill_timeout: 10000,
      max_memory_restart: "768M",
      time: true,
      env: {
        NODE_ENV: "production",
        HOSTNAME: "127.0.0.1",
        PORT: "3011",
        API_BASE_URL: "https://api.chessview.org/api",
        NEXT_PUBLIC_SITE_URL: "https://chessview.org",
        NEXT_PUBLIC_POSTHOG_HOST: "/ingest"
      }
    }
  ]
};
