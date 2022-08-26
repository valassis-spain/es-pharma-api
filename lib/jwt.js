const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const {logger} = require('../config');

const privateKey = fs.readFileSync(path.join(__dirname, '../keys', 'pharma_id_rsa'), 'utf8');
const publicKey = fs.readFileSync(path.join(__dirname, '../keys', 'pharma_id_rsa.pub'), 'utf8');

module.exports = {
  issueAccessToken: (payload) => {
    try {
      return jwt.sign(payload, privateKey, {
        algorithm: 'RS256',
        expiresIn: process.env.ACCESS_EXPIRED_IN,
        issuer: process.env.TOKEN_ISSUER
      });
    }
    catch (err) {
      /*
          TODO throw http 500 here
          ! Dont send JWT error messages to the client
          ! Let exception handler handles this error
      */
      throw err;
    }
  },

  issueRefreshToken: (payload) => {
    try {
      return jwt.sign(payload, privateKey, {
        algorithm: 'RS256',
        expiresIn: process.env.REFRESH_EXPIRED_IN,
        issuer: process.env.TOKEN_ISSUER
      });
    }
    catch (err) {
      /*
          TODO throw http 500 here
          ! Dont send JWT error messages to the client
          ! Let exception handler handles this error
      */
      throw err;
    }
  },

  verifyToken: (token) => {
    try {
      return jwt.verify(token, publicKey, {algorithm: 'RS256'});
    }
    catch (err) {
      /*
          TODO throw http 500 here
          ! Dont send JWT error messages to the client
          ! Let exception handler handles this error
      */
      throw err;
    }
  },

  verifyAccesToken: (req, res, next) => {
    try {
      const parameters = req.query['params'] ? JSON.parse(decodeURI(req.query['params'])) : '';
      const token = req.body['access_token'] || req.query['access_token'] || parameters['access_token'];

      if (!token)
        req.pharmaApiError = {name: 'AccessTokenNotFound', message: 'Access Token not found', stack: ''};

      jwt.verify(token, publicKey, {algorithm: 'RS256'}, (err, decoded) => {
        if (err) {
          logger.error('[verifyAccesToken] ' + err.name);
          logger.error('[verifyAccesToken] ' + err.message);
          logger.debug('[verifyAccesToken] ' + err.stack);

          req.pharmaApiError = err;
        }
        else {
          logger.info('[verifyAccesToken] Access granted, valid signature');
          logger.debug(`[verifyAccesToken] ${JSON.stringify(decoded, null, 2)}`);
          delete decoded.exp;
          delete decoded.iss;
          req.pharmaApiAccessToken = decoded;
        }
      });
    }
    catch (error) {
      logger.error(`[verifyPharmaToken] ${error.message}`);
      logger.debug(`[verifyPharmaToken] ${error.stack}`);

      req.pharmaApiError = error;
    }

    next();
  }
};
