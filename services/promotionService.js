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

  await toolService.registerAudit({
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
  const date = new Date(this.valueOf());
  date.setDate(date.getDate() + days);

  return date;
};

async function getPublicPromotions(token, params) {
  let query = 'select' +
    ' p.id_promotion,' +
    ' p.PROMOTION_APP promoAPP,' +
    ' p.promotion_description,' +
    // ' p.promotion_end_date,' +
    ' convert(varchar(10),p.promotion_end_date,111) promotion_end_date,' +
    ' p.promotion_name,' +
    // ' p.promotion_postmark_date,' +
    ' convert(varchar(10),p.promotion_postmark_date,111) promotion_postmark_date,' +
    ' p.promotion_reference,' +
    // ' p.promotion_start_date,' +
    ' convert(varchar(10),p.promotion_start_date,111) promotion_start_date,' +
    ' p.id_product_promotion_a,' +
    ' p.product_promotion_a_description,' +
    ' p.id_product_promotion_b,' +
    ' p.product_promotion_b_description,';

  if (params.filter === 'app') {
    query += `isnull(sum(pl.TOTAL_PRIZES),0) totalp,
      isnull(sum(pl.VALID_PRIZES),0) totalv,
      isnull(sum(py.AMOUNT),0.0) amount,
      convert(varchar(10),isnull(max(wc.WEEK_CLOSURE_DATE),getdate()),111) promotion_last_sync_date 
    from PS_DIM_PROMOTION p 
      left  join PS_FACT_POS_LETTER pl  on p.ID_PROMOTION=pl.ID_promotion and pl.ID_POS=@idPos 
      left join PS_FACT_PAYMENT py on pl.ID_POS_LETTER = py.ID_POS_LETTER 
      left join PS_DIM_WEEKLY_CLOSURE wc on pl.ID_WEEK_CLOSURE = wc.ID_WEEK_CLOSURE
      where  
        p.PROMOTION_END_DATE >= @since 
        and p.PROMOTION_START_DATE <= @until 
        AND p.PRIVATE_PROMOTION=0 
        AND p.PROMOTION_APP=1 
      group by p.ID_PROMOTION, 
        p.PROMOTION_APP, 
        p.promotion_description, 
        p.promotion_end_date, 
        p.promotion_name, 
        p.promotion_postmark_date, 
        p.promotion_reference, 
        p.promotion_start_date,
        p.id_product_promotion_a,
        p.product_promotion_a_description,
        p.id_product_promotion_b,
        p.product_promotion_b_description`;
  }
  else if (params.filter === 'test') {
    query += `isnull(sum(pl.TOTAL_PRIZES),0) totalp,
        isnull(sum(pl.VALID_PRIZES),0) totalv,
        isnull(sum(py.AMOUNT),0.0) amount,
        convert(varchar(10),isnull(max(wc.WEEK_CLOSURE_DATE),getdate()),111) promotion_last_sync_date 
      from PS_DIM_PROMOTION p 
        left  join PS_FACT_POS_LETTER pl  on p.ID_PROMOTION=pl.ID_promotion 
        left join PS_FACT_PAYMENT py on pl.ID_POS_LETTER = py.ID_POS_LETTER
        left join PS_DIM_WEEKLY_CLOSURE wc on pl.ID_WEEK_CLOSURE = wc.ID_WEEK_CLOSURE
        where  
          p.PROMOTION_END_DATE >= @since 
          and p.PROMOTION_START_DATE <= @util
          AND p.PROMOTION_APP=1 
        group by p.ID_PROMOTION, 
          p.PROMOTION_APP, 
          p.promotion_description, 
          p.promotion_end_date, 
          p.promotion_name, 
          p.promotion_postmark_date, 
          p.promotion_reference, 
          p.promotion_start_date,
          p.id_product_promotion_a,
          p.product_promotion_a_description,
          p.id_product_promotion_b,
          p.product_promotion_b_description`;
  }
  else {
    query += `0 AS totalp,
        0 AS totalv,
        0 AS amount,
        convert(varchar(10),getdate(),111) AS promotion_last_sync_date 
      from PS_DIM_PROMOTION p
      where 
        PRIVATE_PROMOTION = 0
        and p.PROMOTION_START_DATE <= @since
        and p.PROMOTION_POSTMARK_DATE >= @until
        and p.POS_PROMOTION = 1
        and p.ID_PRODUCT_PROMOTION_A is not null
        and p.PROMOTION_APP = 1 `;
  }

  const queryParams = {};
  queryParams.since = params.since;
  queryParams.until = params.until;

  if (params.filter === 'app') queryParams.idPos = token.idPos;

  const mappingPromotions = await mssqlDb.launchPreparedQuery('transaction', query, queryParams);

  return mappingPromotions;
}

async function getPrivatePromotions(token, params) {
  let query = '';

  if (params.filter === 'app') {
    query += 'select ' +
      ' p.id_promotion,' +
      ' p.PROMOTION_APP promoAPP,' +
      ' p.promotion_description,' +
      // ' p.promotion_end_date,' +
      ' convert(varchar(10),p.promotion_end_date,111) promotion_end_date,' +
      ' p.promotion_name,' +
      // ' p.promotion_postmark_date,' +
      ' convert(varchar(10),p.promotion_postmark_date,111) promotion_postmark_date,' +
      ' p.promotion_reference,' +
      // ' p.promotion_start_date,' +
      ' convert(varchar(10),p.promotion_start_date,111) promotion_start_date,' +
      ' p.id_product_promotion_a,' +
      ' p.product_promotion_a_description,' +
      ' p.id_product_promotion_b,' +
      ' p.product_promotion_b_description, ' +
      ' isnull(sum(pl.TOTAL_PRIZES),0) totalp,' +
      ' isnull(sum(pl.VALID_PRIZES),0) totalv,' +
      ' isnull(sum(py.AMOUNT),0.0) amount,' +
      ' isnull(max(wc.WEEK_CLOSURE_DATE),getdate()) max_cierre ' +
      'from PS_DIM_PROMOTION p ' +
      'left join PS_FACT_POS_LETTER pl  on p.ID_PROMOTION=pl.ID_promotion and pl.ID_POS= @idPos ' +
      'left join PS_FACT_PAYMENT py on pl.ID_POS_LETTER = py.ID_POS_LETTER ' +
      'join PS_DIM_POS_PROMOTION ppp on ppp.ID_PROMOTION=p.ID_PROMOTION and ppp.ID_POS= @idPos ' +
      'left join PS_DIM_WEEKLY_CLOSURE wc on pl.ID_WEEK_CLOSURE = wc.ID_WEEK_CLOSURE ' +
      'WHERE p.PROMOTION_END_DATE >= @since ' +
      'AND p.PROMOTION_START_DATE <= @until ' +
      'AND p.PRIVATE_PROMOTION=1 ' +
      'AND p.PROMOTION_APP=1 ' +
      'group BY p.id_promotion, p.PROMOTION_APP, p.promotion_description, p.promotion_end_date,' +
      ' p.promotion_name, p.promotion_postmark_date, p.promotion_reference,' +
      ' p.promotion_start_date, p.id_product_promotion_a, p.product_promotion_a_description,' +
      ' p.id_product_promotion_b, p.product_promotion_b_description';
  }
  else {
    query += ' select distinct pp.promotion, 0 AS totalp,0 AS totalv,0 AS amount,getdate() AS promotion_last_sync_date' +
      ' from PosPromotion pp' +
      ' where pp.pointOfSale.id = @idPos ' +
      ' and pp.promotion.promotionStartDate <= @since' +
      ' and pp.promotion.promotionPostmarkDate >= @until ' +
      ' and pp.promotion.posPromotion = 1 ' +
      ' and pp.promotion.promotionApp = 1 ';
  }

  const queryParams = {};
  queryParams.since = params.since;
  queryParams.until = params.until;
  queryParams.idPos = token.idPos;

  const mappingPromotions = await mssqlDb.launchPreparedQuery('transaction', query, queryParams);

  return mappingPromotions;
}

function generateDemoPromotions() {
  const random = Math.floor(Math.random() * 90);
  const promotions = [];

  for (let promoType = 0; promoType < 8; promoType++) {
    const today = new Date();
    let promoDate = new Date();
    promoDate = promoDate.addDays(random);

    let genericNumberForTickets = 0;

    const demoPromo = {};

    switch (promoType) {
      case 0: // Promo expired
        promoDate = today.addDays(-120);
        demoPromo.promotionDescription = 'Promoción demo Caducada';
        break;
      case 1: // future promo
        demoPromo.promotionDescription = 'Promoción demo en el futuro';
        promoDate = today.addDays(+6);
        break;
      case 2: // Promo over but still possible to upload tickets
        demoPromo.promotionDescription = 'Promoción demo Caducada pero habilitada';
        promoDate = today.addDays(-91);
        genericNumberForTickets = random + 10;
        break;
      case 3: // Promo active but 1 day  to expire
        demoPromo.promotionDescription = 'Promoción demo 1 día para caducar';
        promoDate = today.addDays(-89);
        genericNumberForTickets = random + 10;
        break;
      case 4: // Promo active but less than 7 days  to expire
        demoPromo.promotionDescription = 'Promoción demo 7 días para caducar';
        promoDate = today.addDays(-86);
        genericNumberForTickets = random + 10;
        break;
      case 5: // Promo over but with participations
        demoPromo.promotionDescription = 'Promoción demo caducada con participaciones';
        promoDate = today.addDays(-120);
        genericNumberForTickets = random + 10;
        break;
      default: // number of sent tickets  between 10 and 100
        demoPromo.promotionDescription = 'Promoción demo mas de 10 tickets';
        genericNumberForTickets = random + 10;
        break;
    } // end switch

    demoPromo.id = promoType;
    demoPromo.promotionApp = true;
    demoPromo.promotionStartDate = promoDate;
    demoPromo.promotionPostmarkDate = promoDate.addDays(+100);
    demoPromo.promotionEndDate = promoDate.addDays(+90);
    demoPromo.name = 'Promotion Demo ' + promoType;
    demoPromo.reference = '99999P999' + promoType;
    demoPromo.idProductPromotionA = 1;
    demoPromo.productPromotionADescription = 'Product demo A';
    demoPromo.idProductPromotionB = 2;
    demoPromo.productPromotionBDescription = 'Product demo B';

    // Adding Data to List activePromotions
    // total premios
    demoPromo.totalp = genericNumberForTickets > 0 ? genericNumberForTickets : 0;
    // total Valids
    demoPromo.totalv = genericNumberForTickets > 0 ? genericNumberForTickets - random + 1 : 0;
    // total prize
    demoPromo.amount = genericNumberForTickets > 0 ? (genericNumberForTickets * (random + 1)) : 0;
    demoPromo.promotion_last_sync_date = new Date();
    promotions.push(demoPromo);
  }

  return promotions;
}

function processSinceUntilParams(params) {
  if (!params.since)
    params.since = (new Date()).addDays(-parseInt(process.env.PHARMA_MAX_DAYS_FOR_SHOWING_PROMOS));

  // if until param is not defined, it will be today or 15 days after today in case of APP or TEST
  if (!params.until) {
    params.until = new Date();

    if (params.filter === 'app' || params.filter === 'test')
      params.until = params.until.addDays(parseInt(process.env.PHARMA_MAX_DAYS_FOR_SHOWING_FUTURE_PROMOS));
  }
}

promotionService.prototype.pharmaPromotionList = async function(token, idPos, params) {
  const response = {};
  let activePromotions = [];

  try {
    // if since param is not defined, it will be 180 before today
    processSinceUntilParams(params);

    // activePromotions = await getPrivatePromotions(token, params);

    if ((token.sub === 'demo@mail.com' || token.sub === 'demo@savispain.es') && params.filter !== 'secret') {
      // get demo promotions
      activePromotions = generateDemoPromotions();
    }
    else if ((token.sub === 'test@savispain.es' || token.sub === 'soporte@savispain.es' || token.idPos === 99999) && params.filter !== 'secret') {
      params.filter = 'test';
      // get getPublicPromotions(filter, timestampSince, timestampUntil, claims)
      activePromotions = await getPublicPromotions(token, params);
    }
    else if (params.filter === 'secret') {
      // for showing to customer all the private promotions where he can't participate
      // By the moment it will shows only brands and not Promotions
      // activePromotions = getSecretPromotions(timestampSince, timestampUntil, claims)
    }
    else {
      // public promotions
      // activePromotions = getPublicPromotions(cmd.filter, timestampSince, timestampUntil, claims)
      activePromotions = await getPublicPromotions(token, params);
      // Add Private Promotions
      const privatePromotions = await getPrivatePromotions(token, params);

      for ( const promotion of privatePromotions) {
        activePromotions.push(promotion);
      }
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

    response.promotions = activePromotions;
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);

    response.error = e.message;
  }

  return response;
};

exports.promotionService = promotionService;

exports.create = function() {
  return new promotionService();
};
