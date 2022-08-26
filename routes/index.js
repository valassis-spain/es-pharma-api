const {Router} = require('express');
const {logger} = require('../config');
const router = Router();

// Raiz
router.get('/', (req, res) => {
  logger.info('main page');

  res.json(
    {
      Title: 'Hola mundo usando rutas!'
    }
  );
});

router.get('/test', function(req, res) {
  logger.info('main page TEST');
  res.json({mensaje: '¡Test!'});
});

router.post('/', function(req, res) {
  logger.info('main page');
  res.json({mensaje: 'Método post'});
});

router.delete('/', function(req, res) {
  logger.info('main page');
  res.json({mensaje: 'Método delete'});
});

module.exports = router;
