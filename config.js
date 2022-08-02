const {createLogger, format, transports} = require('winston');
// const {combine, timestamp, printf} = require('winston').format;
const {combine, printf} = require('winston').format;
require('dotenv').config();

const options = {
  sqlConfig: {
    user: process.env.SQL_USERNAME || 'sa',
    password: process.env.SQL_PASSWORD || '',
    server: process.env.SQL_SERVER || 'BIDB',
    database: process.env.SQL_DBNAME || 'PS_PHARMA',
    port: 1433,
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    },
    options: {
      tdsVersion: process.env.TDS_VERSION || '7_4',
      requestTimeout: 60000,
      enableArithAbort: true,
      encrypt: false,
      useUTC: false
    }
  }
};

const logger = createLogger({
  format: combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    printf((info) => {
      return `${info.timestamp} ${info.level}: ${info.message}`;
    })
  ),
  transports: [
    new transports.Console({
      level: process.env.LOG_LEVEL,
      handleExceptions: true,
      json: false,
      colorize: false
    })
  ],
  exitOnError: false // do not exit on handled exceptions
});

options.logger = logger;

function timeConversion(millisec) {
  const mili = (millisec);

  const seconds = (millisec / 1000).toFixed(2);

  const minutes = (millisec / (1000 * 60)).toFixed(2);

  const hours = (millisec / (1000 * 60 * 60)).toFixed(2);

  const days = (millisec / (1000 * 60 * 60 * 24)).toFixed(2);

  if (seconds < 1)
    return mili + ' ms';
  else if (seconds < 60)
    return seconds + ' Sec';
  else if (minutes < 60)
    return minutes + ' Min';
  else if (hours < 24)
    return hours + ' Hrs';
  else
    return days + ' Days';
}

const timing = {
  infoStart: (msg) => {
    logger.info(msg);

    return Date.now();
  },
  debugStart: (msg) => {
    logger.debug(msg);

    return Date.now();
  },
  debugStop: (msg, ts) => {
    const diff = Date.now() - ts;
    logger.debug(`${msg}: ${timeConversion(diff)}`);
  },
  infoStop: (msg, ts) => {
    const diff = Date.now() - ts;
    logger.info(`${msg}: ${timeConversion(diff)}`);
  }
};

options.timing = timing;

module.exports = options;
