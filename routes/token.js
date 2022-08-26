const {Router} = require('express');
const {logger} = require('../config');
const router = Router();

const {verifyToken, issueAccessToken, issueRefreshToken} = require('../lib/jwt');

router.get('/verify', async (req, res) => {
  const resStatus = 200;

  const {access_token} = req.query;

  logger.info('Token Verify requested');

  try {
    const verified = verifyToken(access_token);
    logger.debug({verified});

    res.json(
      verified
    );
  }
  catch (e) {
    logger.error(e.stack);
    res.status(resStatus === 200 ? 500 : resStatus).json({message: `Token verify error [${e.message}]`});
  }
});

router.post('/refresh', async (req, res) => {
  let resStatus = 200;

  try {
    const {refresh_token} = req.body;

    logger.info('Token Refresh requested');

    if (!refresh_token) {
      resStatus = 403;
      throw new Error('Not a refresh token!');
    }

    const verified = verifyToken(refresh_token);
    logger.debug({verified});

    if (!verified[process.env.REFRESH_CLAIM]) {
      resStatus = 403;
      throw new Error('Not a refresh token!');
    }

    delete(verified['exp']); // expired
    delete(verified['iss']); // issuer

    verified[process.env.ACCESS_CLAIM] = true;
    delete (verified[process.env.REFRESH_CLAIM]);

    const access_token = issueAccessToken(verified);

    delete (verified[process.env.ACCESS_CLAIM]);
    verified[process.env.REFRESH_CLAIM] = true;

    const new_refresh_token = issueRefreshToken(verified);

    res.json(
      {
        access_token: access_token,
        refresh_token: new_refresh_token
      }
    );
  }
  catch (e) {
    console.error(e.stack);
    res.status(resStatus === 200 ? 500 : resStatus).json({message: `Token refresh error [${e.message}]`});
  }
});

module.exports = router;
