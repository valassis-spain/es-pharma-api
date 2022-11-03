const {logger} = require('../config');
// const {issueAccessToken} = require('../lib/jwt');
const mssqlDb = require('../lib/mssqldb').create();
const toolService = require('../services/toolService').create();

const promotionService = function() {
};

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

async function getPromotionDetail(token, idPromotion, params) {

  let query = 'select ' +
    ' DateAdd(DAY,cast(substring(REF_LETTER,14,3) as integer),DateFromParts(1999+cast(substring(REF_LETTER,12,2) as integer),12,31)) creationDate,' +
    ' pl.ID_POS_LETTER id, ' +
    ' pl.ID_PROMOTION, ' +
    '   pl.ID_POS, ' +
    '   pl.ID_WEEK_CLOSURE, ' +
    '   pl.TOTAL_PRIZES totalPrizes, ' +
    '   pl.VALID_PRIZES validPrizes, ' +
    '   pl.VALID_AMOUNT validAmount, ' +
    '   pl.REF_LETTER refLetter, ' +
    '   isnull(pl.CLAIMED_CUPONS,0) claimedCoupons, ' +
    '   isnull(pl.CLAIMED_AMOUNT,0) claimedAmount, ' +
    '   pl.INVALID_PRIZES invalidPrizes, ' +
    '   pl.FAIL_COUPON failCoupon, ' +
    '   pl.FAIL_PRODUCT failProduct, ' +
    '   pl.FAIL_FORM failForm, ' +
    '   pl.FAIL_POSTMARK failPostMark, ' +
    '   pl.FAIL_TICKET_DATE failTicketDate, ' +
    '   pl.FAIL_TICKET_ID failticketId, ' +
    '   pl.FAIL_SALES_LIST failSalesList, ' +
    '   pl.FAIL_PRIVATE_PROMOTION failPrivatePromotion, ' +
    '   pl.LETTER_PAYMENTS letterPayments, ' +
    '   py.PAYMENT_DATE, ' +
    '   py.HONOR_DATE, ' +
    '   pdwc.WEEK_CLOSURE_DATE ' +
    ' from PS_FACT_PAYMENT py ' +
    ' left join PS_FACT_POS_LETTER pl on py.ID_POS_LETTER = pl.ID_POS_LETTER ' +
    ' left join PS_DIM_WEEKLY_CLOSURE pdwc on pl.ID_WEEK_CLOSURE = pdwc.ID_WEEK_CLOSURE ' +
    'where pl.ID_POS = @idPos' +
    '  and pl.ID_PROMOTION = @idPromotion;'

  const queryParams = {};
  queryParams.idPos = token.idPos;
  queryParams.idPromotion = idPromotion;

  if (params.weekClosure) {
    query += ' and and pdwc.ID_WEEK_CLOSURE = @weekClosure'
    queryParams.weekClosure = params.weekClosure;
  }

  const mappingPromotion = await mssqlDb.launchPreparedQuery('transaction', query, queryParams);

  return mappingPromotion;

}

async function getPromotionResume(token, idPromotion, params) {
  let query = 'select ' +
    'data.ID_WEEK_CLOSURE as idWeekClosure, ' +
    'data.WEEK_CLOSURE_DATE as weekClosureDate,' +
    'sum(data.totalLetters)  totalLetters,' +
    'sum(data.totalPrizes) totalPrizes,' +
    'sum(data.validPrizes) validPrizes,' +
    'sum(data.invalidPrizes) invalidPrizes,' +
    'sum(data.validAmount) validAmount,' +
    'sum(data.paidAmount)  paidAmount ' +
    ' from (' +
    '    SELECT ' +
    ' pl.ID_WEEK_CLOSURE,wk.WEEK_CLOSURE_DATE,' +
    ' totalPrizes = sum(pl.TOTAL_PRIZES),' +
    ' validPrizes= sum(pl.VALID_PRIZES),' +
    ' invalidPrizes=sum(pl.INVALID_PRIZES),' +
    ' validAmount=sum(pl.VALID_AMOUNT),' +
    ' totalLetters=count(distinct pl.ID_POS_LETTER),' +
    ' paidAmount=(select sum(AMOUNT) from PS_FACT_PAYMENT py WHERE py.ID_POS_LETTER =pl.ID_POS_LETTER) ' +
    ' FROM PS_FACT_POS_LETTER pl ' +
    ' JOIN PS_DIM_WEEKLY_CLOSURE wk ' +
    ' on pl.ID_WEEK_CLOSURE=wk.ID_WEEK_CLOSURE ' +
    ' JOIN PS_FACT_PAYMENT  pay ' +
    ' on pl.ID_POS_LETTER=pay.ID_POS_LETTER ' +
    ' and pay.HONOR_DATE>=@since ' +
    ' and pay.HONOR_DATE<=@until ' +
    ' where pl.ID_POS = @idPos ' +
    ' and pl.ID_PROMOTION = @idPromo ' +
    ' GROUP BY pl.ID_WEEK_CLOSURE,wk.WEEK_CLOSURE_DATE,pl.ID_POS_LETTER ' +
    ') data ' +
    'group by data.WEEK_CLOSURE_DATE, data.ID_WEEK_CLOSURE';

  const queryParams = {};
  queryParams.since = params.since;
  queryParams.until = params.until;
  queryParams.idPos = token.idPos;
  queryParams.idPromo = idPromotion;

  const mappingPromotion = await mssqlDb.launchPreparedQuery('transaction', query, queryParams);

  return mappingPromotion;
}

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
      ' 0 totalp,' +
      ' 0 totalv,' +
      ' 0 amount,' +
      ' convert(varchar(10),getDate(),111) max_cierre ' +
      'from PS_DIM_PROMOTION p ' +
      'left join PS_FACT_POS_LETTER pl  on p.ID_PROMOTION=pl.ID_promotion ' +
      'left join PS_FACT_PAYMENT py on pl.ID_POS_LETTER = py.ID_POS_LETTER ' +
      'join PS_DIM_POS_PROMOTION ppp on ppp.ID_PROMOTION=p.ID_PROMOTION and ppp.ID_POS= pl.ID_POS ' +
      'WHERE pl.ID_POS= @idPos ' +
      'AND p.PROMOTION_POSTMARK_DATE >= @until ' +
      'AND p.PROMOTION_START_DATE <= @since ' +
      'AND p.PRIVATE_PROMOTION=1 ' +
      'AND p.PROMOTION_APP=1 ' +
      'group BY p.id_promotion, p.PROMOTION_APP, p.promotion_description, p.promotion_end_date,' +
      ' p.promotion_name, p.promotion_postmark_date, p.promotion_reference,' +
      ' p.promotion_start_date, p.id_product_promotion_a, p.product_promotion_a_description,' +
      ' p.id_product_promotion_b, p.product_promotion_b_description';
  }

  const queryParams = {};
  queryParams.since = params.since;
  queryParams.until = params.until;
  queryParams.idPos = token.idPos;

  const mappingPromotions = await mssqlDb.launchPreparedQuery('transaction', query, queryParams);

  return mappingPromotions;
}

async function getSecretPromotions(token, params) {
  let query = ' select \'secret\' AS promoType,' +
    'p.ID_PROMOTION,' +
    'b.ID_BRAND,' +
    'b.BRAND_NAME,' +
    'm.MANUFACTURER_NAME, ' +
    'CASE WHEN EXISTS (SELECT * FROM USER_PROMO_INFO_REQUEST u WHERE u.ID_POS = @idPos AND u.ID_PROMOTION=p.ID_PROMOTION )THEN \'TRUE\' ELSE \'FALSE\' END as USER_REQUEST ' +
    'from PS_DIM_PROMOTION p ' +
    'JOIN PS_DIM_BRAND b ' +
    'on b.ID_BRAND = p.ID_BRAND ' +
    'join PS_DIM_MANUFACTURER m ' +
    'on m.ID_MANUFACTURER=b.ID_MANUFACTURER ' +
    'join PS_DIM_POS_PROMOTION ppp on ppp.ID_PROMOTION=p.ID_PROMOTION and ppp.ID_POS!=@idPos ' +
    'WHERE p.PROMOTION_POSTMARK_DATE >= @since ' +
    'AND p.PROMOTION_START_DATE <= @until ' +
    'AND p.PRIVATE_PROMOTION=1 ' +
    'AND p.PROMOTION_APP=1 ' +
    'group BY p.ID_PROMOTION,b.ID_BRAND,b.BRAND_NAME,m.MANUFACTURER_NAME';

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

promotionService.prototype.pharmaPromotionInfo = async function(token, idPromotion, params) {
  let response = {};
  let activePromotions = [];

  try {

    if (params.resume) {
      // if since param is not defined, it will be 180 before today
      processSinceUntilParams(params);

      // def closureCards = getPromoResume(claims, promotionId as long, pairSinceAndUntil)
      response = await getPromotionResume(token, idPromotion, params);
    }
    else {
      // def PaymentCards = getPromoDetails(claims, promotionId as long, weekClosure )
      response = await getPromotionDetail(token, idPromotion, params);
    }
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);

    response.error = e.message;
  }

  return response;
};

promotionService.prototype.pharmaPromotionList = async function(token, idPos, params) {
  const response = {};
  let activePromotions = [];

  try {
    // if since param is not defined, it will be 180 before today
    processSinceUntilParams(params);

    if ((token.sub === 'demo@mail.com' || token.sub === 'demo@savispain.es') && params.filter !== 'secret') {
      // get demo promotions
      activePromotions = generateDemoPromotions();
    }
    else if ((token.sub === 'test@savispain.es' || token.sub === 'soporte@savispain.es' || token.idPos === 99999) && params.filter !== 'secret') {
      params.filter = 'test';
      activePromotions = await getPublicPromotions(token, params);
    }
    else if (params.filter === 'secret') {
      // for showing to customer all the private promotions where he can't participate
      // By the moment it will shows only brands and not Promotions
      activePromotions = await getSecretPromotions(token, params);
    }
    else {
      // public promotions
      activePromotions = await getPublicPromotions(token, params);

      // Add Private Promotions
      const privatePromotions = await getPrivatePromotions(token, params);

      for (const promotion of privatePromotions) {
        activePromotions.push(promotion);
      }
    }

    // build Product Promotions property when don't request secret promotions
    if (params.filter !== 'secret')
      promotionFormatForProductPromotion(activePromotions);

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
