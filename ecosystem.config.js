module.exports = {
  apps: [{
    name: 'es-pharma-api',
    script: 'index.js',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    }
  }]
};
