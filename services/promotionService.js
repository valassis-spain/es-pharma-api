const {logger} = require('../config');
// const {issueAccessToken} = require('../lib/jwt');
const mssqlDb = require('../lib/mssqldb').create();
const toolService = require('../services/toolService').create();

const promotionService = function() {
};

promotionService.prototype.getPromotionsByPosAndManufacturer = async function(token, idManufacturer, idPos) {
  const response = await mssqlDb.launchQuery('transaction', `select pdp.ID_PROMOTION
     , pdp.PROMOTION_NAME
     , pdp.PROMOTION_REFERENCE
     , replace(convert(varchar(10),pdp.PROMOTION_END_DATE,111),'/','-') PROMOTION_END_DATE
     , replace(convert(varchar(10),pdp.PROMOTION_START_DATE,111),'/','-') PROMOTION_START_DATE
     , replace(convert(varchar(10),pdp.PROMOTION_POSTMARK_DATE,111),'/','-') PROMOTION_POSTMARK_DATE
     , (select pdpp.ID_POS
        from PS_DIM_POS_PROMOTION pdpp
        where pdpp.ID_PROMOTION = pdp.ID_PROMOTION and pdpp.ID_POS = ${idPos}) id_pos
     , (select pdpp.POS_LIMIT
        from PS_DIM_POS_PROMOTION pdpp
        where pdpp.ID_PROMOTION = pdp.ID_PROMOTION and pdpp.ID_POS = ${idPos}) limit        
      , ( select count(*)
        from PS_FACT_POS_LETTER pl
        where pl.ID_POS = ${idPos} and pl.ID_PROMOTION = pdp.ID_PROMOTION) letters
from PS_DIM_PROMOTION pdp
         left join PS_DIM_BRAND pdb on pdp.ID_BRAND = pdb.ID_BRAND
where pdb.ID_MANUFACTURER = ${idManufacturer}
  and pdp.PROMOTION_POSTMARK_DATE > dateadd(DAY, -30, current_timestamp)`);

  toolService.registerAudit({
    user_id: token.idUser,
    eventName: 'get Promotions',
    eventType: 'READ',
    tableName: 'PS_DIM_PROMOTIONS',
    rowId: idPos,
    data: `Manufacturer ${idManufacturer} POS ${idPos}`
  });

  return response;
};

Date.prototype.addDays = function(days) {
  var date = new Date(this.valueOf());
  date.setDate(date.getDate() + days);
  return date;
}

function generateDemoPromotions() {
  const random = Math.floor(Math.random() * 90);
  const promotions = [];

  for (let promoType = 0; promoType < 8; promoType++) {
    const today = new Date();
    let promoDate =  new Date();
    promoDate = promoDate.addDays(random);

    let genericNumberForTickets = 0;

    switch (promoType) {
      case 0:
        //Promo expired
        promoDate = today.addDays(-120);
        break;
      case 1:
        //future promo
        promoDate = today.addDays(+ 6);
        break;
      case 2:
        //Promo over but still possible to upload tickets
        promoDate = today.addDays(- 91);
        genericNumberForTickets = random + 10;
        break;
      case 3:
        //Promo active but 1 day  to expire
        promoDate = today.addDays(- 89);
        genericNumberForTickets = random + 10;
        break;
      case 4:
        //Promo active but less than 7 days  to expire
        promoDate = today.addDays(- 86);
        genericNumberForTickets = random + 10;
        break;
      case 5:
        //Promo over but with participations
        promoDate = today.addDays(- 120);
      default:
        //number of sent tickets  between 10 and 100
        genericNumberForTickets = random + 10;
        break;

    } // end switch

    const demoPromo = {};
    demoPromo.id = promoType;
    demoPromo.promotionApp = true;
    demoPromo.promotionDescription = 'Promoción demo ' + promoType;
    demoPromo.promotionStartDate = promoDate;
    demoPromo.promotionPostmarkDate = promoDate.addDays(+ 100);
    demoPromo.promotionEndDate = promoDate.addDays(+ 90);
    demoPromo.name = 'Promotion Demo ' + promoType;
    demoPromo.reference = '99999P999' + promoType;
    demoPromo.idProductPromotionA = 1;
    demoPromo.productPromotionADescription = 'Product demo A';
    demoPromo.idProductPromotionB = 2;
    demoPromo.productPromotionBDescription = 'Product demo B';

  }
}

promotionService.prototype.pharmaPromotionList = async function(token, idPos, params) {
  const response = {};

  // if since param is not defined, it will be 180 before today
  if (!params.since) {
    params.since = (new Date()).getDate() - parseInt(process.env.PHARMA_MAX_DAYS_FOR_SHOWING_PROMOS);
  }

  // if until param is not defined, it will be today or 15 days after today in case of APP or TEST
  if (!params.until) {
    params.until = new Date();
    if (params.filter === 'app' || params.filter === 'test')
      params.until = params.until.getDate() + parseInt(process.env.PHARMA_MAX_DAYS_FOR_SHOWING_FUTURE_PROMOS);
  }
  generateDemoPromotions();

  if ((token.sub === 'demo@mail.com' || token.sub === 'demo@savispain.es') && params.filter !=='secret') {
    // get demo promotions
    generateDemoPromotions();

  }
  else if ((token.sub === 'test@savispain.es' || token.sub === 'soporte@savispain.es' || token.idPos === 99999) && params.filter !== 'secret') {
    params.filter = 'test';
    //get getPublicPromotions(filter, timestampSince, timestampUntil, claims)
  }
  else if (cmd.filter.equals('secret')) {
    //for showing to customer all the private promotions where he can't participate
    //By the moment it will shows only brands and not Promotions
    // activePromotions = getSecretPromotions(timestampSince, timestampUntil, claims)
  }
  else {
    // public promotions
    // activePromotions = getPublicPromotions(cmd.filter, timestampSince, timestampUntil, claims)
    //Add Private Promotions
    // def privatePromotions = getPrivatePromotions(cmd.filter, timestampSince, timestampUntil, claims)
  }
  //
  // switch (cmd.filter) {
  //   //for rendering promos and not secret promos with brand info
  //   case 'secret':
  //     for (promo in activePromotions) {
  //       def thisPromo = new JSONSecretPromotion(promo[0] as Promotion)
  //       thisPromo.setpromoType(promo[1] as String)
  //       thisPromo.setBrandName(promo[2] as String)
  //       thisPromo.setManufacturerName(promo[3] as String)
  //       thisPromo.setUserRequest(promo[4] as String)
  //       JSONPromotions << thisPromo
  //     }
  //     break
  //   default:
  //     for (promo in activePromotions) {
  //       def thisPromo = new JSONPromotion(promo[0] as Promotion)
  //       thisPromo.setTotalp(promo[1] as int)
  //       thisPromo.setTotalv(promo[2] as int)
  //       thisPromo.setAmount(promo[3] as BigDecimal)
  //       thisPromo.setPromotion_last_sync_date(promo[4] as Date)
  //       JSONPromotions << thisPromo
  //     }
  // }

  const query = 'insert into dbo.DEVICES (ID_POS, DEVICE_ID, DEVICE_MODEL, DEVICE_TOKEN, SO, SO_VERSION, APP_NAME, APP_VERSION, CREATED_AT, UPDATED_AT, DEVICE_BRAND) ' +
    'values (@idPos, @deviceId, @deviceModel, @deviceToken, @so, @soVersion, @appName, @appVersion, current_timestamp, current_timestamp, @deviceBrand)';

  try {
    await mssqlDb.launchPreparedQuery('transaction', query, params);

    toolService.registerAudit({
      user_id: token.idUser,
      eventName: 'add new Device',
      eventType: 'INSERT',
      tableName: 'DEVICE',
      rowId: idPos,
      data: ''
    });

    logger.info('Device added successfully');
    response.message = 'Device added successfully';
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);

    response.error = e.message;
  }
}

exports.promotionService = promotionService;

exports.create = function() {
  return new promotionService();
};
