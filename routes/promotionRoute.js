const {Router} = require('express');
const {logger} = require('../config');
// const {issueAccessToken} = require('../lib/jwt');
// const toolService = require('../services/toolService').create();
const promotionService = require('../services/promotionService').create();

const router = Router();

function promotionFormatForProductPromotion(mappingPromotions) {
  for (const promotion of mappingPromotions.promotions) {
    promotion.products = [];
    promotion.products[0] = {};
    promotion.products[0].id_product_promotion = promotion.id_product_promotion_a;
    promotion.products[0].product_promotion_name = promotion.product_promotion_a_description;
    delete promotion.id_product_promotion_a;
    delete promotion.product_promotion_a_description;

    if (promotion.id_product_promotion_b) {
      promotion.products[1] = {};
      promotion.products[1].id_product_promotion = promotion.id_product_promotion_b;
      promotion.products[1].product_promotion_name = promotion.product_promotion_b_description;
      delete promotion.id_product_promotion_b;
      delete promotion.product_promotion_b_description;
    }
  }
}

router.get('/', async function(req, res, next) {
  logger.debug('GET Promotions');

  // const {origin} = req.body;
  const {since, until, filter} = req.query;
  const token = req.pharmaApiAccessToken;

  logger.debug(`POST: ${JSON.stringify(req.body)}`);
  logger.debug(`GET: ${JSON.stringify(req.query)}`);

  try {
    const mappingPromotions = await promotionService.pharmaPromotionList(token, token.idPos, {
      since,
      until,
      filter
    });

    // build Product Promotions property when don't request secret promotion
    if (filter !== 'secret')
      promotionFormatForProductPromotion(mappingPromotions);

    res.status(200).json(mappingPromotions.promotions);
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);

    res.status(500).json({error: e.message});
  }
});

module.exports = router;
