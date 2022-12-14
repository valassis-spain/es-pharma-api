const {Router} = require('express');
const {logger} = require('../config');
const router = Router();

const pointOfSaleService = require('../services/pointOfSaleService').create();
const promotionService = require('../services/promotionService').create();
const delegadoService = require('../services/delegadoService').create();
const bridgeService = require('../services/bridgeService').create();
const geocodeService = require('../lib/geocode')

// const {verifyAccesToken} = require('../lib/jwt');
const {issueAccessToken} = require('../lib/jwt');

// get Delegado's points of sale or Point of Sale details
router.post('/', async function(req, res) {
  logger.info('Consulta Puntos de Venta');

  // const {origin} = req.body;
  const {
    idManufacturer,
    idPos,
    quicksearch,
    pendingPaymentsLast3Months,
    pendingPaymentsLastMonth,
    invalidTicketsLast3Months,
    invalidTicketsLastMonth
  } = req.body;

  let {idDelegado} = req.body;

  const token = req.pharmaApiAccessToken;

  let pointOfSale;

  if (idDelegado) {
    logger.info(`Delegado by parameter: [${idDelegado}]`);
  }
  else {
    idDelegado = token.idUser;
    logger.info(`Delegado by token: [${token.idUser}]`);
  }

  if (!idDelegado) idDelegado = token.idUser;

  try {
    pointOfSale = await pointOfSaleService.getListPointOfSaleByDelegado(token, {
      idManufacturer,
      idDelegado,
      idPos,
      quicksearch,
      pendingPaymentsLast3Months,
      pendingPaymentsLastMonth,
      invalidTicketsLast3Months,
      invalidTicketsLastMonth
    });
    // }

    logger.info('end find');

    res.status(200).json({pointOfSale: pointOfSale, accessToken: issueAccessToken(token)});
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);

    res.status(500).json({error: e.message});
  }
});

router.post('/posInfo', async function(req, res) {
  logger.info('Consulta Detalles de Punto de Venta');

  const {idPos} = req.body;
  const {idManufacturer} = req.body;
  const token = req.pharmaApiAccessToken;
  let errors;

  try {
    const mappingPos = await pointOfSaleService.getPointOfSaleDetails(token, idManufacturer, idPos);

    if (mappingPos.length === 0) {
      errors = true;
      res.status(404).json({error: 'Point of Sale not found.'});
    }

    if (!errors) {
      const mappingPromotions = await promotionService.getPromotionsByPosAndManufacturer(token, idManufacturer, idPos);

      const mappingDelegado = await delegadoService.getDelegadoByPos(token, idManufacturer, idPos);

      const mappingLocation = await geocodeService.FindByKeyWord(mappingPos[0].MAIN_STREET+','+mappingPos[0].MAIN_ZIP_CODE+','+mappingPos[0].MAIN_CITY+','+mappingPos[0].MAIN_STATE);

      mappingPos[0].promotions = mappingPromotions;
      mappingPos[0].delegado = mappingDelegado;
      mappingPos[0].location = mappingLocation;

      logger.info('end pos details');

      res.status(200).json({pointOfSale: mappingPos[0], accessToken: issueAccessToken(token)});
    }
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);

    res.status(500).json({error: e.message});
  }
});

router.post('/posPromotions', async function(req, res) {
  logger.info('Consulta Promociones Puntos de Venta');

  // const {origin} = req.body;
  // const {idDelegado} = req.body;
  const {idPos} = req.body;
  const {idManufacturer} = req.body;
  const token = req.pharmaApiAccessToken;

  try {
    const mappingPromotions = await promotionService.getPromotionsByPosAndManufacturer(token, idManufacturer, idPos);

    logger.info('end posPromotions');

    res.status(200).json({promotions: mappingPromotions, accessToken: issueAccessToken(token)});
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);

    res.status(500).json({error: e.message});
  }
});

router.put('/linkPromotion', async function(req, res) {
  logger.info('Asociar Punto de Venta a Promocion');

  // const {origin} = req.body;
  const {idPos, idPromotion, limit} = req.body;
  const {idManufacturer} = req.body;
  const token = req.pharmaApiAccessToken;
  let errors = false;

  try {
    const mappginPos = await pointOfSaleService.getPointOfSaleDetails(token, idManufacturer, idPos);

    if (mappginPos.length === 0) {
      errors = true;
      logger.error(`Point of sale ${idPos} not found fo manufacturer ${idManufacturer}`);
      res.status(404).json({error: 'Point of Sale not found.'});
    }

    if (!errors) {
      const mappingPromotions = await promotionService.getPromotionsByPosAndManufacturer(token, idManufacturer, idPos);

      let promotion;

      for (const myPromotion of mappingPromotions)
        if (myPromotion.ID_PROMOTION === idPromotion) promotion = myPromotion;

      if (!promotion) {
        res.status(404).json({error: 'Promotion not found'});
        logger.error(`Promotion ${idPromotion} is not available for Point of sale ${idPos}`);
        errors = true;
      }
      else if (promotion.id_pos) {
        res.status(400).json({error: 'Pos is linked to promotion'});
        logger.error(`Point of sale ${idPos} is linked to promotion ${idPromotion}`);
        errors = true;
      }
    }

    if (!errors) {
      // const mappingLink =
      await pointOfSaleService.createLinkPointOfSaleToPromotion(token, idManufacturer, idPos, idPromotion, limit);

      logger.info(`Point of Sale ${idPos} liked to promotion ${idPromotion}`);
      logger.info('end linkPromotion');

      res.status(200).json({message: 'Point of Sale linked to promotion', accessToken: issueAccessToken(token)});
    }
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);

    res.status(500).json({error: e.message});
  }
});

router.post('/updatelinkpromotion', async function(req, res) {
  logger.info('Actualizar asociacion Punto de Venta a Promocion');

  // const {origin} = req.body;
  const {idPos, idPromotion, limit} = req.body;
  const {idManufacturer} = req.body;
  const token = req.pharmaApiAccessToken;
  let errors = false;

  try {
    const mappginPos = await pointOfSaleService.getPointOfSaleDetails(token, idManufacturer, idPos);

    if (mappginPos.length === 0) {
      errors = true;
      logger.error(`Point of sale ${idPos} not found fo manufacturer ${idManufacturer}`);
      res.status(404).json({error: 'Point of Sale not found.'});
    }

    if (!errors) {
      const mappingPromotions = await promotionService.getPromotionsByPosAndManufacturer(token, idManufacturer, idPos);

      let promotion;

      for (const myPromotion of mappingPromotions)
        if (myPromotion.ID_PROMOTION === idPromotion) promotion = myPromotion;

      if (!promotion) {
        res.status(404).json({error: 'Promotion not found'});
        logger.error(`Promotion ${idPromotion} is not available for Point of sale ${idPos}`);
        errors = true;
      }
      else if (!promotion.id_pos) {
        res.status(400).json({error: 'Pos is not linked to promotion'});
        logger.error(`Point of sale ${idPos} is not linked to promotion ${idPromotion}`);
        errors = true;
      }
    }

    if (!errors) {
      // const mappingLink =
      await pointOfSaleService.updateLinkPointOfSaleToPromotion(token, idManufacturer, idPos, idPromotion, limit);

      logger.info(`Update link between Point of Sale ${idPos} and promotion ${idPromotion}`);
      logger.info('end updatelinkpromotion');

      res.status(200).json({
        message: 'Updated link between Point of Sale and promotion',
        accessToken: issueAccessToken(token)
      });
    }
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);

    res.status(500).json({error: e.message});
  }
});

router.post('/promotioninfo', async function(req, res) {
  logger.info('Informaci??n del punto de venta para la promoci??n');

  // const {origin} = req.body;
  const {idPos, idPromotion} = req.body;
  const {idManufacturer} = req.body;
  const token = req.pharmaApiAccessToken;
  let errors = false;

  try {
    const bridgeResponse = await bridgeService.userview(token, 16116, 6952);

    if (!bridgeResponse) {
      res.status(500).json({error: 'ERROR calling to bridge'});
      errors = true;
    }

    if (!errors) {
      let posLetterInfo = await promotionService.pharmaPromotionInfo(token, idPromotion, {idPos, idManufacturer});

      if (!posLetterInfo) {
        // this point of sale don't have letters
        posLetterInfo = [];
      }

      // set payment values
      for (const dayWithData of bridgeResponse.info.days) {
        logger.debug(`con ${dayWithData.date}`);

        for (const payment of posLetterInfo) {
          const paymentDate = new Date(2000 + parseInt(payment.year), 0, 1);
          paymentDate.setDate(paymentDate.getDate() + parseInt(payment.dayofyear));

          // if (dayWithData.date == paymentDate.toISOString().split('T')[0]) {
          if (dayWithData.date === payment.creationDate) {
            dayWithData.valid_prizes = parseInt(payment.validPrizes);
            dayWithData.invalid_prizes = parseInt(payment.invalidPrizes);
            dayWithData.FAIL_COUPON = payment.failCoupon;
            dayWithData.FAIL_FORM = payment.failForm;
            dayWithData.FAIL_POSTMARK = payment.failPostMark;
            dayWithData.FAIL_PRIVATE_PROMOTION = payment.failPrivatePromotion;
            dayWithData.FAIL_PRODUCT = payment.failProduct;
            dayWithData.FAIL_SALES_LIST = payment.failSalesList;
            dayWithData.FAIL_TICKET_DATE = payment.failTicketDate;
            dayWithData.FAIL_TICKET_ID = payment.failticketId;

            if (payment.validPrizes === 0) {
              dayWithData.state = 'invalid';
            }
            else if (payment.PAYMENT_DATE) {
              dayWithData.state = 'closed';
              dayWithData.amount = payment.validAmount;

              if (payment.HONOR_DATE)
                dayWithData.paymentDate = payment.HONOR_DATE.toISOString().split('T')[0];
            }
            else {
              dayWithData.state = 'pending';
            }

            break;
          }

          // logger.debug(`${dayWithData.date} con ${paymentDate.toISOString().split('T')[0]}`);
          logger.debug(`${dayWithData.date} con ${payment.creationDate}`);
        } // end for each payment
      } // end for each day with submissions
    }

    bridgeResponse.access_token = issueAccessToken(token);
    res.status(200).json(bridgeResponse);
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);

    res.status(500).json({error: e.message});
  }
});

router.post('/stats', async function(req, res) {
  logger.info('Informaci??n Estadistica del punto de venta para el fabricante');

  // const {origin} = req.body;
  const {idPos} = req.body;
  const {idManufacturer} = req.body;
  const token = req.pharmaApiAccessToken;

  try {
    const mappingStatistics = await pointOfSaleService.getStatistics(token, idManufacturer, idPos);

    mappingStatistics.access_token = issueAccessToken(token);
    res.status(200).json(mappingStatistics);
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);

    res.status(500).json({error: e.message});
  }
});

module.exports = router;
