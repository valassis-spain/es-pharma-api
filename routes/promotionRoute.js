const {Router} = require('express');
const {logger} = require('../config');
// const {issueAccessToken} = require('../lib/jwt');
// const toolService = require('../services/toolService').create();
const promotionService = require('../services/promotionService').create();

const router = Router();

router.get('/', async function(req, res, next) {
  logger.debug('GET Promotions');

  // const {origin} = req.body;
  const {since=null, until=null, filter=''} = req.query;
  const token = req.pharmaApiAccessToken;

  logger.debug(`POST: ${JSON.stringify(req.body)}`);
  logger.debug(`GET: ${JSON.stringify(req.query)}`);

  try {
    const mappingPromotions = await promotionService.pharmaPromotionList(token, token.idPos, {
      since,
      until,
      filter
    });

    logger.debug ( `Response 200 OK with ${mappingPromotions.promotions.length} records`);

    res.status(200).json(mappingPromotions.promotions);
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);

    logger.debug ( 'Response 500 KO');

    res.status(500).json({error: e.message});
  }
});

router.post('/:idPromotion', async function(req, res, next) {
  logger.debug('GET Promotions');

  // const {origin} = req.body;
  const {idPromotion} = req.params;
  const {since=null, until=null, resume='', weekClosure=''} = req.body;
  const token = req.pharmaApiAccessToken;

  logger.debug(`POST: ${JSON.stringify(req.body)}`);
  logger.debug(`GET: ${JSON.stringify(req.query)}`);

  try {
    const mappingPromotions = await promotionService.pharmaPromotionInfo(token, idPromotion, {
      since,
      until,
      resume,
      weekClosure
    });

    logger.debug ( `Response 200 OK with ${mappingPromotions.length} records`);

    res.status(200).json(mappingPromotions);
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);

    logger.debug ( 'Response 500 KO');

    res.status(500).json({error: e.message});
  }
});

module.exports = router;
