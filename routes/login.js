const {Router} = require('express');
const {logger} = require('../config');
const router = Router();
const mssqlDb = require('../lib/mssqldb').create();

const {verifyToken, issueAccessToken, issueRefreshToken} = require('../lib/jwt');

const message01 = 'Invalid credentials!';
const message02 = 'Incorrect user or password!';
const message03 = 'User access denied!';

// Raiz
router.post('/', async (req, res) => {
  const bcrypt = require('bcrypt');
  let resStatus = 200;

  const {username, password, origin} = req.body;

  logger.info(`login page {username:${username}}`);

  try {
    if (!username || !password) {
      resStatus = 403;
      logger.debug('No username or password received');

      await mssqlDb.registerAudit({
        user_id: 52,
        eventName: 'login failed',
        eventType: 'READ',
        tableName: 'USERS',
        rowId: 0,
        data: 'No username or password received'
      });

      throw new Error(message01 + ' (L1)');
    }

    const mapping = await mssqlDb.launchQuery('transaction', `select us.idUser, us.sUsername, us.sPassword, us.id_pos, us.enabled, us.account_Expired, us.account_Locked, us.password_Expired, pos.category from users us left join PS_DIM_POINT_OF_SALE pos on pos.id_pos = us.id_pos where us.sUsername = '${username}'`);

    if (mapping.length !== 1) {
      resStatus = 403;
      logger.debug(`User not Found [${mapping.length} of ${username}]`);

      await mssqlDb.registerAudit({
        user_id: 52,
        eventName: 'login failed',
        eventType: 'READ',
        tableName: 'USERS',
        rowId: 0,
        data: `User not Found [${mapping.length} of ${username}]`
      });

      throw new Error(message01 + ' (L2)');
    }

    const match = await bcrypt.compare(password, mapping[0].sPassword);

    if (!match) {
      resStatus = 403;
      logger.debug(`Password not match [${username}]`);

      await mssqlDb.registerAudit({
        user_id: mapping[0].idUser,
        eventName: 'login failed',
        eventType: 'READ',
        tableName: 'USERS',
        rowId: 0,
        data: `Password not match [${username}]`
      });

      throw new Error(message02 + ' (L3)');
    }

    // verify user details
    if (!mapping[0].enabled || mapping[0].account_Expired || mapping[0].account_Locked || mapping[0].password_Expired) {
      resStatus = 403;
      logger.debug(`disabled user [${username}]`);

      await mssqlDb.registerAudit({
        user_id: mapping[0].idUser,
        eventName: 'login failed',
        eventType: 'READ',
        tableName: 'USERS',
        rowId: 0,
        data: `disabled user [${username}]`
      });

      throw new Error(message03 + ' (L4)');
    }

    // test origin
    const isMemberOf = await mssqlDb.memberOf(origin, username);

    if (origin === process.env.ORIGIN_APP && !(isMemberOf.user || isMemberOf.admin)) {
      logger.debug(`User is not Pharma [${username}]`);

      await mssqlDb.registerAudit({
        user_id: mapping[0].idUser,
        eventName: 'login failed',
        eventType: 'READ',
        tableName: 'USERS',
        rowId: 0,
        data: `User is not Pharma [${username}]`
      });
    }

    if (origin === process.env.ORIGIN_DELEGADO && !(isMemberOf.delegado || isMemberOf.supervisor)) {
      resStatus = 403;
      logger.debug(`User is not Delegado [${username}]`);

      await mssqlDb.registerAudit({
        user_id: mapping[0].idUser,
        eventName: 'login failed',
        eventType: 'READ',
        tableName: 'USERS',
        rowId: 0,
        data: `User is not Delegado [${username}]`
      });

      throw new Error(message03 + ' (L6)');
    }

    const accessClaim = {
      idPos: mapping[0].id_pos,
      idUser: mapping[0].idUser,
      country: 'es'
    };

    const refreshClaim = {
      idPos: mapping[0].id_pos,
      idUser: mapping[0].idUser,
      country: 'es'
    };

    accessClaim[process.env.ACCESS_CLAIM] = true;
    accessClaim['sub'] = username;
    refreshClaim[process.env.REFRESH_CLAIM] = true;
    refreshClaim['sub'] = username;

    const access_token = issueAccessToken(accessClaim);
    const refresh_token = issueRefreshToken(refreshClaim);

    const verified = verifyToken(access_token);
    logger.debug(`JWT verification: ${JSON.stringify(verified)}`);

    mssqlDb.registerAudit({
      user_id: mapping[0].idUser,
      eventName: 'login success',
      eventType: 'READ',
      tableName: 'USERS',
      rowId: mapping[0].idUser,
      data: username
    });

    mssqlDb.registerActivity({
      user_id: mapping[0].idUser,
      idPos: mapping[0].id_pos,
      action: 'Login',
      origin: origin
    });

    logger.info(`Access granted to ${username}`);

    res.json(
      {
        id_pos: mapping[0].id_pos,
        id_user: mapping[0].idUser,
        status: mapping[0].category,
        roles: isMemberOf.roles,
        access_token: access_token,
        refresh_token: refresh_token,
        country: ''
      }
    );
  }
  catch (e) {
    logger.error(e.stack);
    res.status(resStatus === 200 ? 500 : resStatus).json({message: e.message + ' (LE)'});
  }
});

module.exports = router;
