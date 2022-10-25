const {Router} = require('express');
const {logger} = require('../config');
const {issueAccessToken} = require('../lib/jwt');
const toolService = require('../services/toolService').create();

const router = Router();

router.put('/', async function(req, res, next) {
  logger.debug('Put Device');

  const {origin} = req.body;
  const token = req.pharmaApiAccessToken;
  // const {idUser} = req.query;

  logger.debug (`POST: ${JSON.stringify(req.body)}`)
  logger.debug (`GET: ${JSON.stringify(req.query)}`)


    res.status(200).json({message: 'ok'});
});

module.exports = router;
