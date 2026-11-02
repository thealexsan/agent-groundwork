module.exports = {
  apps: [
    {
      name: "{{SLUG}}-web",
      script: "server.js",
      cwd: "/var/www/{{SLUG}}/.next/standalone",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        HOSTNAME: "127.0.0.1",
        API_URL: "http://127.0.0.1:8080",
        APP_ORIGIN: "https://{{DOMAIN}}",
      },
    },
    {
      name: "{{SLUG}}-api",
      script: "/var/www/{{SLUG}}/bin/api",
      interpreter: "none",
      cwd: "/var/www/{{SLUG}}",
      env: {
        ENV_FILE: "/var/www/{{SLUG}}/.env",
        ADDR: "127.0.0.1:8080",
      },
    },
  ],
};
