const {Router} = require('express');
const {logger} = require("../config");
const router = Router();
const mssqlDb = require('../lib/mssqldb').create()

const {verifyToken, issueAccessToken, issueRefreshToken} = require('../lib/jwt')

const message01 = 'Invalid credentials!';
const message02 = 'Incorrect user or password!';
const message03 = 'User access denied!';

//Raiz
router.post('/', async (req, res) => {
  const bcrypt = require('bcrypt');
  let resStatus = 200;

  logger.info(`login page`)

  const {username, password} = req.body

  try {
    if (!username || !password) {
      resStatus = 403;
      throw new Error(message01 + ' (L1)')
    }

    const mapping = await mssqlDb.launchQuery('transaction',
      `select us.sUsername, us.sPassword, us.id_pos, us.enabled, us.account_Expired, us.account_Locked, us.password_Expired, pos.category from users us left join PS_DIM_POINT_OF_SALE pos on pos.id_pos = us.id_pos where us.sUsername = '${username}'`
    )

    if (mapping.length !== 1) {
      resStatus = 403;
      throw new Error(message01 + ' (L2)')
    }

    const match = await bcrypt.compare(password, mapping[0].sPassword);

    if (!match) {
      resStatus = 403;
      throw new Error(message02 + ' (L3)')
    }

    // verify user details
    if (!mapping[0].enabled || mapping[0].account_Expired || mapping[0].account_Locked || mapping[0].password_Expired) {
      resStatus = 403;
      throw new Error(message03 + ' (L4)')
    }

    let accessClaim = {
      idPos: mapping[0].id_pos,
      country: 'es'
    }

    let refreshClaim = {
      idPos: mapping[0].id_pos,
      country: 'es'
    }

    accessClaim[process.env.ACCESS_CLAIM]=true;
    accessClaim['sub']=username
    refreshClaim[process.env.REFRESH_CLAIM]=true;
    refreshClaim['sub']=username

    const access_token = issueAccessToken(accessClaim);
    const refresh_token = issueRefreshToken(refreshClaim);

    const verified = verifyToken(access_token)
    console.log({ verified })

    res.json(
      {
        id_pos: mapping[0].id_pos,
        status: mapping[0].category,
        access_token: access_token,
        refresh_token: refresh_token,
        country: ''
      }
    );
  }
  catch (e) {
    console.error(e.stack);
    res.status(resStatus === 200 ? 500 : resStatus).json({message: e.message + ' (L5)'});
  }
})

module.exports = router;
