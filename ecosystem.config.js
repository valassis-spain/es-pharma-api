module.exports = {
  apps : [{
    name: 'es-pharma-api',
    script: 'index',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    }
  }],
};
