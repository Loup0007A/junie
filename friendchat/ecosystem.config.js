// PM2 ecosystem config — run with: pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'friendchat',
      script: './server/index.js',
      cwd: __dirname,
      instances: 1,          // socket.io requires sticky sessions for > 1
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'development',
        PORT: 4000,
        CLIENT_URL: 'http://localhost:3000',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000,
        // CLIENT_URL is read from .env file in production
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
