const {Router} = require('express');
const {logger} = require('../config');
const {issueAccessToken} = require('../lib/jwt');
const toolService = require('../services/toolService').create();
const deviceService = require('../services/deviceService').create();

const router = Router();

router.put('/', async function(req, res, next) {
  logger.debug('Put Device');

  const {origin} = req.body;
  const token = req.pharmaApiAccessToken;

  logger.debug(`POST: ${JSON.stringify(req.body)}`)
  logger.debug(`GET: ${JSON.stringify(req.query)}`)

  try {
    const response = await deviceService.addDevice(token, token.idPos);

    if ( response.error )
      res.status(500).json({error: response.error});
    else
      res.status(200).json({message: response.message});
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);

    res.status(500).json({error: e.message});
  }
});

module.exports = router;
