const {logger} = require('../config');
// const {issueAccessToken} = require('../lib/jwt');
const toolService = require('./toolService').create();
const mssqlDb = require('../lib/mssqldb').create();

const pointOfSaleService = function() {
};

/**
 *
 * @param {jwt} token Access Token of user connected
 * @param {int} idUser User Id
 * @param {int} idPos Point of Sale Id
 * @return {Promise<{code: number, message: string}>}
 * **-3:** farmacia no es NORMAL <br>
 * **-2:** farmacia no encontrada <br>
 * **-1:** excepción <br>
 * **&nbsp;0:** farmacia **NO** asociada al usuario <br>
 * **&nbsp;1:** farmacia asociada al usuario como **DELEGADO** <br>
 * **&nbsp;2:** farmaia asociada al usuario como **SUPERVISOR** <br>
 */
pointOfSaleService.prototype.isUserPosLinked = async function(token, idUser, idPos) {
  try {
    // search my PdVs
    const mappingPdv = await mssqlDb.launchQuery('transaction', `select pos.ID_POS, pos.CATEGORY, up.ID_USER, sup.ID_SUPERVISOR
    from PS_DIM_POINT_OF_SALE pos
    left join USER_POS up on up.ID_POS = pos.ID_POS
    left join SUPERVISOR sup on sup.ID_USER = up.ID_USER or sup.ID_SUPERVISOR = up.ID_USER
    where pos.ID_POS = ${idPos}`);

    if (mappingPdv.length === 0) {
      toolService.registerAudit({
        user_id: token.idUser,
        eventName: 'Read POS Not Found',
        eventType: 'READ',
        tableName: 'PS_DIM_POINT_OF_SALE',
        rowId: idUser,
        data: idPos
      });

      logger.info(`[isUserPosLinked] Point of sale [${idPos}] not found`);

      return {code: -2, message: 'Point of Sale not found'};
    }

    toolService.registerAudit({
      user_id: idUser,
      eventName: 'Read User - Points of Sale',
      eventType: 'READ',
      tableName: 'PS_DIM_POINT_OF_SALE',
      rowId: idPos,
      data: ''
    });

    for (const relation of mappingPdv) {
      if (relation.CATEGORY !== 'NORMAL') {
        logger.info(`[isUserPosLinked] Point of sale [${idPos}] DISABLED`);

        return {code: -3, message: 'Point of sale disabled'}; // farmacia está inhabilitada
      }

      if (relation.ID_USER === idUser) {
        logger.info(`[isUserPosLinked] Point of sale [${idPos}] linked with user [${idUser}] as DELEGADO`);

        return {code: 1, message: 'Point of sale linked as DELEGADO'}; // farmacia asociada al delegado
      }

      if (relation.ID_SUPERVISOR === idUser) {
        logger.info(`[isUserPosLinked] Point of sale [${idPos}] linked with user [${idUser}] as SUPERVISOR`);

        return {code: 2, message: 'Point of sale linked as SUPERVISOR'}; // farmacia asociada a un delegado bajo mi supervision
      }
    } // end for relations

    logger.info(`[isUserPosLinked] Point of sale [${idPos}] is not linked with user [${idUser}]`);

    return {code: 0, message: 'Point of Sale not linked with user'};
  }
  catch (e) {
    logger.error(e.message);
    logger.error(e.stack);

    return {code: -1, message: e.message}; // excepción
  }
};

pointOfSaleService.prototype.getPointOfSaleDelegado = async function(token, idPos) {
  const response = await mssqlDb.launchQuery('transaction', `select up.ID_POS, sup.ID_USER, sup.ID_SUPERVISOR, us.susername, us.enabled, us.ACCOUNT_LOCKED
from USER_POS up
         join SUPERVISOR sup on up.ID_USER = sup.ID_USER
         join users us on us.idUser = up.ID_USER
where up.REMOVED_AT is null
  and sup.REMOVED_AT is null
  and up.id_pos = ${idPos}`);

  toolService.registerAudit({
    user_id: token.idUser,
    eventName: 'get delegado linked to point of sale',
    eventType: 'READ',
    tableName: 'USER_POS',
    rowId: idPos,
    data: token.sub
  });

  return response;
};

pointOfSaleService.prototype.getPointsOfSaleByPromotion = async function(token, idPromotion) {
  const response = await mssqlDb.launchQuery(`select * from PS_DIM_PROMOTION pdp
join PS_DIM_BRAND pdb on pdp.ID_BRAND = pdb.ID_BRAND
         join PS_DIM_POS_PROMOTION pdpp on pdpp.ID_PROMOTION = pdp.ID_PROMOTION
         join PS_DIM_POINT_OF_SALE pos on pos.ID_POS = pdpp.ID_POS
where pdpp.ID_PROMOTION = ${idPromotion}`);

  toolService.registerAudit({
    user_id: token.idUser,
    eventName: 'get point of sale by Promotion',
    eventType: 'READ',
    tableName: 'PS_DIM_POINT_OF_SALE',
    rowId: idPromotion,
    data: token.sub
  });

  return response;
};

pointOfSaleService.prototype.getListPointOfSaleByDelegado = async function(token, filter = {all: ''}, pageNumber = 1, rowsOfPage = 0) {
  let filter2apply = '';

  if (filter.quicksearch) {
    filter2apply += ` and ( pos.CIF like '%${filter.quicksearch}%' 
    or pos.main_zip_code like '%${filter.quicksearch}%'
    or pos.name like '%${filter.quicksearch}%'
    or pos.email like '%${filter.quicksearch}%'
    or pos.phone like '%${filter.quicksearch}%'
    or pos.contact_person like '%${filter.quicksearch}%'
    or pos.main_city like '%${filter.quicksearch}%'
    or pos.main_state like '%${filter.quicksearch}%'
    )`;
  }

  if (filter.idPos)
    filter2apply += ` and pos.id_pos = ${filter.idPos} `;

  const response = await mssqlDb.launchQuery('transaction', `select up.ID_USER,
       us.sUsername,
       pos.ID_POS,
       pdmp.MANUFACTURER_POS_CODE manufacturer_code,
       NAME,
       CIF,
       EMAIL,
       PHONE,
       CELL_PHONE,
       CONTACT_PERSON,
       pos.MAILING_NOTIFICATION,
       MAIN_STREET,
       MAIN_CITY,
       MAIN_STATE,
       MAIN_ZIP_CODE,
       POS_APP,
       CATEGORY,
       REMOTE_STORE_ID,
       COUNTRY,
       ${pageNumber}  PAGE,
       ${rowsOfPage} ROWS_OF_PAGE,
       myjoin.letters,
       myjoin.invalid_prizes,
       myjoin.honor_date,
       myjoin.amount
from PS_DIM_POINT_OF_SALE pos
         join user_pos up on up.ID_POS = pos.ID_POS
         join users us on up.ID_USER = us.idUser
         left join PS_DIM_MANUFACTURER_POS pdmp on pdmp.ID_POS = pos.ID_POS and pdmp.ID_MANUFACTURER = ${filter.idManufacturer}
         left join (select distinct pl.id_pos,
                               count(distinct pl.ref_letter) letters,
                               sum(pl.INVALID_PRIZES)        invalid_prizes,
                               max(fp.HONOR_DATE)            honor_date,
                               sum(fp.amount + fp.bonification) amount
               from PS_FACT_POS_LETTER pl
                        join PS_DIM_WEEKLY_CLOSURE wc on pl.ID_WEEK_CLOSURE = wc.ID_WEEK_CLOSURE
                        left join PS_FACT_PAYMENT fp on pl.ID_POS_LETTER = fp.ID_POS_LETTER
                        join PS_DIM_PROMOTION pdp on pl.ID_PROMOTION = pdp.ID_PROMOTION
                        join PS_DIM_BRAND pdb on pdp.ID_BRAND = pdb.ID_BRAND and pdb.ID_MANUFACTURER = ${filter.idManufacturer}
               where 1 = 1
                 ${filter.invalidTicketsLastMonth || filter.pendingPaymentsLastMonth ? 'and datediff(mm, current_timestamp, wc.WEEK_CLOSURE_DATE) >= -1' : ''}
                 ${filter.invalidTicketsLast3Months || filter.pendingPaymentsLast3Months ? 'and datediff(mm, current_timestamp, wc.WEEK_CLOSURE_DATE) >= -3' : ''}
                 ${filter.invalidTicketsLastMonth || filter.invalidTicketsLast3Months ? 'and pl.INVALID_PRIZES > 0' : ''}
                 ${filter.pendingPaymentsLastMonth || filter.pendingPaymentsLast3Months ? 'and fp.HONOR_DATE is null' : ''}
                 ${filter.pendingPaymentsLastMonth || filter.pendingPaymentsLast3Months ? 'and fp.AMOUNT + fp.BONIFICATION > 0' : ''}
               group by pl.id_pos) myjoin on myjoin.ID_POS = pos.ID_POS
where pos.ID_POS in (
    select distinct(id_pos)
   from USER_POS up
   where up.id_user = ${filter.idDelegado}
      or up.ID_USER in (select SUPERVISOR.ID_USER
                        from SUPERVISOR
                        where ID_SUPERVISOR = ${filter.idDelegado})
)
${filter.invalidTicketsLastMonth || filter.pendingPaymentsLastMonth ? 'and myjoin.invalid_prizes > 0' : ''}
${filter.pendingPaymentsLastMonth || filter.pendingPaymentsLast3Months ? 'and myjoin.honor_date is null and myjoin.amount > 0' : ''}
${filter2apply}
ORDER BY ID_POS 
OFFSET (${pageNumber}-1)*${rowsOfPage} ROWS
${rowsOfPage > 0 ? `FETCH NEXT ${rowsOfPage} ROWS ONLY` : ''}`);

  toolService.registerAudit({
    user_id: token.idUser,
    eventName: 'get points of sale by delegado',
    eventType: 'READ',
    tableName: 'PS_DIM_POINT_OF_SALE',
    rowId: filter.idDelegado,
    data: token.sub
  });

  return response;
};

pointOfSaleService.prototype.updateLinkPointOfSaleToDelegado = async function(token, idDelegado, idPos) {
  const response = await mssqlDb.launchQuery('transaction', `update USER_POS set ID_USER=${idDelegado} where ID_POS = ${idPos};`);

  toolService.registerAudit({
    user_id: token.idUser,
    eventName: 'update link Point of Sale to Delegado',
    eventType: 'UPDATE',
    tableName: 'USER_POS',
    rowId: `(select id from user_pos where id_user = ${idDelegado} and id_pos = ${idPos})`,
    data: `pos ${idPos} with user ${idDelegado}`
  });

  return response;
};

pointOfSaleService.prototype.createLinkPointOfSaleToDelegado = async function(token, idDelegado, idPos) {
  const response = await mssqlDb.launchQuery('transaction', `insert into USER_POS (ID_USER, ID_POS, CREATED_AT, REMOVED_AT)
values (${idDelegado},${idPos},current_timestamp,null);`);

  toolService.registerAudit({
    user_id: token.idUser,
    eventName: 'create link Point of Sale to Delegado',
    eventType: 'INSERT',
    tableName: 'USER_POS',
    rowId: '(select max(id) from user_pos)',
    data: `pos ${idPos} with user ${idDelegado}`
  });

  return response;
};

pointOfSaleService.prototype.getPromotions = async function(token, idManufacturer, idPos) {
  const response = await mssqlDb.launchQuery('transaction', `select pdp.ID_PROMOTION
     , pdp.PROMOTION_NAME
     , pdp.PROMOTION_REFERENCE
     , pdp.PROMOTION_END_DATE
     , pdp.PROMOTION_START_DATE
     , pdp.PROMOTION_POSTMARK_DATE
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

pointOfSaleService.prototype.getPointOfSaleDetails = async function(token, idManufacturer, idPos) {
  const response = await mssqlDb.launchQuery('transaction', `select pos.ID_POS,
       NAME,
       CIF,
       EMAIL,
       IBAN,
       PHONE,
       CELL_PHONE,
       CONTACT_PERSON,
       PAYMENT_MEAN,
       MAILING_NOTIFICATION,
       MAIN_STREET,
       MAIN_CITY,
       MAIN_STATE,
       MAIN_ZIP_CODE,
       SHIPMENT_STREET,
       SHIPMENT_CITY,
       SHIPMENT_STATE,
       SHIPMENT_ZIP_CODE,
       POS_APP,
       CATEGORY,
       REMOTE_STORE_ID,
       COUNTRY
from PS_DIM_POINT_OF_SALE pos
left join PS_DIM_MANUFACTURER_POS pdmp on pdmp.ID_POS = pos.ID_POS
where pos.ID_POS = ${idPos}
and pdmp.ID_MANUFACTURER = ${idManufacturer}`);

  toolService.registerAudit({
    user_id: token.idUser,
    eventName: 'get point of sale by ID',
    eventType: 'READ',
    tableName: 'PS_DIM_POINT_OF_SALE',
    rowId: idPos,
    data: token.sub
  });

  return response;
};

pointOfSaleService.prototype.createLinkPointOfSaleToPromotion = async function(token, idManufacturer, idPos, idPromotion, limit) {
  const response = await mssqlDb.launchQuery('transaction', `insert into PS_DIM_POS_PROMOTION (ID_PROMOTION, ID_POS, ID_MESSAGE, POS_LIMIT, POS_MARGIN, DOCUMENT, DOCUMENT_DATE, DOCUMENT_NAME) 
 values 
 (${idPromotion}, ${idPos}, null, ${limit ? limit : 0}, null, null, null, null);`);

  toolService.registerAudit({
    user_id: token.idUser,
    eventName: 'link point of sale to Promotion',
    eventType: 'INSERT',
    tableName: 'PS_DIM_POS_PROMOTION',
    rowId: idPos,
    data: token.sub
  });

  return response;
};

pointOfSaleService.prototype.updateLinkPointOfSaleToPromotion = async function(token, idManufacturer, idPos, idPromotion, limit) {
  const response = await mssqlDb.launchQuery('transaction', `update DIM_POS_PROMOTION set POS_LIMIT=${limit}
where ID_PROMOTION=${idPromotion} and ID_POS=${idPos};`);

  toolService.registerAudit({
    user_id: token.idUser,
    eventName: 'link point of sale to Promotion',
    eventType: 'UPDATE',
    tableName: 'PS_DIM_POS_PROMOTION',
    rowId: idPos,
    data: token.sub
  });

  return response;
};

pointOfSaleService.prototype.getInfoPromotion = async function(token, idManufacturer, idPos, idPromotion) {
  const response = await mssqlDb.launchQuery('transaction', `select
      substring(pl.REF_LETTER, 12,2) year,
      substring(pl.REF_LETTER, 14,3) dayofyear,
      pl.TOTAL_PRIZES,
      pl.VALID_PRIZES,
      pl.INVALID_PRIZES,
      pfp.AMOUNT,
      pfp.BONIFICATION,
      pfp.PAYMENT_DATE,
      pfp.HONOR_DATE,
      pl.FAIL_COUPON,
      pl.FAIL_FORM,
      pl.FAIL_POSTMARK,
      pl.FAIL_PRIVATE_PROMOTION,
      pl.FAIL_PRODUCT,
      pl.FAIL_SALES_LIST,
      pl.FAIL_TICKET_DATE,
      pl.FAIL_TICKET_ID,
      pfp.ID_ASSIGNED_PRIZE
    from PS_FACT_POS_LETTER pl
    left join PS_FACT_PAYMENT pfp on pl.ID_POS_LETTER = pfp.ID_POS_LETTER
    where pl.ID_POS = ${idPos}
      and pl.ID_PROMOTION = ${idPromotion};`);

  toolService.registerAudit({
    user_id: token.idUser,
    eventName: 'Get Point of Sale Letters info',
    eventType: 'READ',
    tableName: 'PS_FACT_POS_LETTER',
    rowId: idPos,
    data: idPromotion
  });

  return response;
};

pointOfSaleService.prototype.getStatistics = async function(token, idManufacturer, idPos) {
  const response1 = await mssqlDb.launchQuery('transaction', `
select 
count(distinct pdp.ID_PROMOTION) total_promotions,
count(distinct pl.ID_PROMOTION) promotions_with_participation
from PS_DIM_POINT_OF_SALE pos
left join PS_DIM_MANUFACTURER pdm on pdm.ID_MANUFACTURER = ${idManufacturer}
left join PS_DIM_BRAND pdb on pdm.ID_MANUFACTURER = pdb.ID_MANUFACTURER
left join PS_DIM_PROMOTION pdp on pdb.ID_BRAND = pdp.ID_BRAND
left join PS_FACT_POS_LETTER pl on pdp.ID_PROMOTION = pl.ID_PROMOTION and pl.ID_POS = pos.ID_POS
where pos.ID_POS = ${idPos}
group by pos.ID_POS;`);

  const response2 = await mssqlDb.launchQuery('transaction', `
select
count(distinct pl.ID_PROMOTION) promos_last_week
from PS_DIM_MANUFACTURER pdm
join PS_DIM_BRAND pdb on pdm.ID_MANUFACTURER = pdb.ID_MANUFACTURER
join PS_DIM_PROMOTION pdp on pdb.ID_BRAND = pdp.ID_BRAND
join PS_FACT_POS_LETTER pl on pdp.ID_PROMOTION = pl.ID_PROMOTION and pl.ID_POS = ${idPos}
join PS_DIM_WEEKLY_CLOSURE pdwc on pl.ID_WEEK_CLOSURE = pdwc.ID_WEEK_CLOSURE and
 datepart(wk, pdwc.WEEK_CLOSURE_DATE) >=
 (datepart(wk, current_timestamp) - 1)
where pdm.ID_MANUFACTURER = ${idManufacturer};`);

  const response3 = await mssqlDb.launchQuery('transaction', `
select 
count(distinct pl.ID_PROMOTION) promos_last_month
from PS_DIM_MANUFACTURER pdm
join PS_DIM_BRAND pdb on pdm.ID_MANUFACTURER = pdb.ID_MANUFACTURER
join PS_DIM_PROMOTION pdp on pdb.ID_BRAND = pdp.ID_BRAND
join PS_FACT_POS_LETTER pl on pdp.ID_PROMOTION = pl.ID_PROMOTION and pl.ID_POS = ${idPos}
join PS_DIM_WEEKLY_CLOSURE pdwc on pl.ID_WEEK_CLOSURE = pdwc.ID_WEEK_CLOSURE and
 datepart(wk, pdwc.WEEK_CLOSURE_DATE) >=
 (datepart(wk, current_timestamp) - 4)
where pdm.ID_MANUFACTURER = ${idManufacturer};`);

  const response4 = await mssqlDb.launchQuery('transaction', `
select 
             cast(avg(data.reimboursement) as decimal(10, 2))         avg_amount_by_promo,
             cast(avg(data.total_prizes) as decimal(10, 2))           avg_total_prizes_by_promo,
             cast(avg(data.valid_prizes) as decimal(10, 2))           avg_valid_prizes_by_promo,
             cast(avg(data.invalid_prizes) as decimal(10, 2))         avg_invalid_prizes_by_promo,
             cast(avg(data.pct_valid_prizes) as decimal(10,2))       pct_valid_prizes,
             cast(avg(data.pct_invalid_prizes)  as decimal(10,2))         pct_invalid_prizes,
             cast(avg(data.pct_FAIL_TICKET_DATE) as decimal(10,2))       pct_FAIL_TICKET_DATE,
             cast(avg(data.pct_FAIL_POSTMARK)  as decimal(10,2))         pct_FAIL_POSTMARK,
             cast(avg(data.pct_FAIL_PRODUCT)  as decimal(10,2))          pct_FAIL_PRODUCT,
             cast(avg(data.pct_FAIL_TICKET_ID)  as decimal(10,2))        pct_FAIL_TICKET_ID,
             cast(avg(data.pct_FAIL_PRIVATE_PROMOTION) as decimal(10,2)) pct_FAIL_PRIVATE_PROMOTION,
             cast(avg(data.amount_by_prizes) as decimal(10, 2))       avg_amount_by_prize_and_promo
from (select pos.ID_POS,
pdp.PROMOTION_REFERENCE,
                   sum(pfp.AMOUNT) + sum(pfp.BONIFICATION)                          reimboursement,
                   sum(pl.TOTAL_PRIZES)                                             total_prizes,
                   sum(pl.VALID_PRIZES)                                             valid_prizes,
                   sum(pl.INVALID_PRIZES)                                           invalid_prizes,
                   case when sum(pl.total_prizes) = 0 then 0 else cast(100.0 * sum(pl.valid_prizes) / sum(pl.total_prizes) as decimal(10, 2)) end             pct_valid_prizes,
                   case when sum(pl.total_prizes) = 0 then 0 else cast(100.0 * sum(pl.invalid_prizes) / sum(pl.total_prizes) as decimal(10, 2)) end          pct_invalid_prizes,
                   case when sum(pl.invalid_prizes) = 0 then 0 else cast(100.0 * sum(pl.FAIL_TICKET_DATE) / sum(pl.invalid_prizes) as decimal(10, 2)) end      pct_FAIL_TICKET_DATE,
                   case when sum(pl.invalid_prizes) = 0 then 0 else cast(100.0 * sum(pl.FAIL_POSTMARK) / sum(pl.invalid_prizes) as decimal(10, 2))  end        pct_FAIL_POSTMARK,
                   case when sum(pl.invalid_prizes) = 0 then 0 else cast(100.0 * sum(pl.FAIL_PRODUCT) / sum(pl.invalid_prizes) as decimal(10, 2)) end          pct_FAIL_PRODUCT,
                   case when sum(pl.invalid_prizes) = 0 then 0 else cast(100.0 * sum(pl.FAIL_TICKET_ID) / sum(pl.invalid_prizes) as decimal(10, 2)) end        pct_FAIL_TICKET_ID,
                   case when sum(pl.invalid_prizes) = 0 then 0 else cast(100.0 * sum(pl.FAIL_PRIVATE_PROMOTION) / sum(pl.invalid_prizes) as decimal(10, 2)) end pct_FAIL_PRIVATE_PROMOTION,
                   sum(pl.FAIL_TICKET_DATE)                                         FAIL_TICKET_DATE,
                   sum(pl.FAIL_POSTMARK)                                            FAIL_POSTMARK,
                   sum(pl.FAIL_PRODUCT)                                             FAIL_PRODUCT,
                   sum(pl.FAIL_TICKET_ID)                                           FAIL_TICKET_ID,
                   sum(pl.FAIL_PRIVATE_PROMOTION)                                   FAIL_PRIVATE_PROMOTION,
                   case when sum(pl.valid_prizes) = 0 then 0 else (sum(pfp.AMOUNT) + sum(pfp.BONIFICATION)) / sum(pl.VALID_PRIZES) end amount_by_prizes
from PS_DIM_POINT_OF_SALE pos
left join PS_DIM_MANUFACTURER pdm on pdm.ID_MANUFACTURER = ${idManufacturer}
left join PS_DIM_BRAND pdb on pdm.ID_MANUFACTURER = pdb.ID_MANUFACTURER
left join PS_DIM_PROMOTION pdp on pdb.ID_BRAND = pdp.ID_BRAND
left join PS_FACT_POS_LETTER pl on pdp.ID_PROMOTION = pl.ID_PROMOTION and pl.ID_POS = pos.ID_POS
left join PS_FACT_PAYMENT pfp on pl.ID_POS_LETTER = pfp.ID_POS_LETTER
where pos.ID_POS = ${idPos}
group by pos.ID_POS, pdp.PROMOTION_REFERENCE) data
group by data.ID_POS;`);

  const response5 = await mssqlDb.launchQuery('transaction', `
  select pos.ID_POS,
       pdb.BRAND_NAME,
             count(distinct pdp.ID_PROMOTION) total_promotions,
             count(distinct pl.ID_PROMOTION)  promotions_with_participation,
             cast(100.0*count(distinct pl.ID_PROMOTION)/count(distinct pdp.ID_PROMOTION) as decimal(10, 2)) pct_promotion_participation
from PS_DIM_POINT_OF_SALE pos
               left join PS_DIM_MANUFACTURER pdm on pdm.ID_MANUFACTURER = ${idManufacturer}
               left join PS_DIM_BRAND pdb on pdm.ID_MANUFACTURER = pdb.ID_MANUFACTURER
               left join PS_DIM_PROMOTION pdp on pdb.ID_BRAND = pdp.ID_BRAND
               left join PS_FACT_POS_LETTER pl on pdp.ID_PROMOTION = pl.ID_PROMOTION and pl.ID_POS = pos.ID_POS
      where pos.ID_POS = ${idPos}
      and pdp.ID_PROMOTION is not null
      group by pos.ID_POS, pdb.BRAND_NAME
  `);
  toolService.registerAudit({
    user_id: token.idUser,
    eventName: 'Get Point of Sale Statistics',
    eventType: 'READ',
    tableName: 'PS_FACT_POS_LETTER',
    rowId: idPos,
    data: idManufacturer
  });

  const total_response = Object.assign({}, response1[0], response2[0], response3[0], response4[0], {brands:response5});

  return total_response;
};

exports.pointOfSaleService = pointOfSaleService;

exports.create = function() {
  return new pointOfSaleService();
};
