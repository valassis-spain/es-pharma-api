const {Router} = require('express');
const {logger} = require('../config');
const {issueAccessToken} = require('../lib/jwt');
const toolService = require('../services/toolService').create();
const promotionService = require('../services/promotionService').create();

const router = Router();

router.get('/', async function(req, res, next) {
  logger.debug('GET Promotions');

  const {origin} = req.body;
  const {since, until, filter} = req.query;
  const token = req.pharmaApiAccessToken;

  logger.debug(`POST: ${JSON.stringify(req.body)}`);
  logger.debug(`GET: ${JSON.stringify(req.query)}`);

  try {
    const mappingPromotions = await promotionService.pharmaPromotionList(token,token.idPos,{
      since,
      until,
      filter
    })

      res.status(200).json({message: 'ok', access_token: issueAccessToken(token)});
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);

    res.status(500).json({error: e.message});
  }
});

module.exports = router;
