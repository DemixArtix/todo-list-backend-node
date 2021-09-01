const jwt = require('jsonwebtoken');
const { secretKey, refreshSecretKey } = require('../config/config');

class TokenService {
    generateTokens(payload) {
      const accessToken = jwt.sign(
        payload,
        secretKey,
        {expiresIn: 60 * 60 });

      const refreshToken = jwt.sign(
        payload,
        refreshSecretKey,
        {expiresIn: 60 * 60 * 24 });

      return {
        accessToken,
        refreshToken
      }
    }
}

module.exports = new TokenService();