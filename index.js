const express = require('express');
const app = express();
const path = require('path');

const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');

const {logger, sqlConfig} = require('./config');

// Configuraciones
app.set('port', process.env.PORT || 8080);
app.set('json spaces', 2);

// Middleware
app.use(express.urlencoded({extended: false}));
app.use(express.json());

// set the view engine to ejs
app.set('view engine', 'ejs');

// static files
app.use('/static', express.static(path.join(__dirname, 'public')));

// routes
var indexRouter = require('./routes/index');
var loginRouter = require('./routes/login');
var tokenRouter = require('./routes/tokenRoute');
var delegadoRouter = require('./routes/delegadoRoute');
var pointOfSaleRouter = require('./routes/pointOfSaleRoute');
var promotionRouter = require('./routes/promotionRoute');
var userRouter = require('./routes/userRoute');
var deviceRouter = require('./routes/deviceRoute');


app.use('*', function(req, res, next) {
  logger.info(`Request URL: ${req.method} ${req.originalUrl}`);
  next();
});

// detect origin
app.use('/api/*', function(req, res, next) {
  req.body.origin = process.env.ORIGIN_APP;
  next();
});


app.use('/api/deleg/*', function(req, res, next) {
  req.body.origin = process.env.ORIGIN_DELEGADO;
  next();
});

// do authentication
app.use('/api/authenticate',  function(req, res, next) {
  logger.debug('Router Login');
  next();
}, loginRouter);

app.use('/api/deleg/authenticate',   function(req, res, next) {
  logger.debug('Router Login');
  next();
}, loginRouter);

// JSON Web Token functionalities
app.use('/api/token',   function(req, res, next) {
  logger.debug('Router Token');
  next();
}, tokenRouter);

// global actions before any call
app.use('/api/*',   function(req, res, next) {
  logger.debug('Router Index');
  next();
}, indexRouter);

// Delegado's functionalities
app.use('/api/deleg/delegado',   function(req, res, next) {
  logger.debug('Router Delegado');
  next();
}, delegadoRouter);

// Point of sale's functionalities
app.use('/api/deleg/pos',   function(req, res, next) {
  logger.debug('Router PointOfSale');
  next();
}, pointOfSaleRouter);

// User's functionalities
app.use('/api/user',   function(req, res, next) {
  logger.debug('Router User');
  next();
}, userRouter);

app.use('/api/deleg/user',   function(req, res, next) {
  logger.debug('Router User');
  next();
}, userRouter);

// Promotion's functionalities
app.use('/api/promotions',   function(req, res, next) {
  logger.debug('Router Promotion');
  next();
}, promotionRouter);

// Device's functionalities
app.use('/api/device',   function(req, res, next) {
  logger.debug('Router Device');
  next();
}, deviceRouter);

// swagger routes
app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerUi.setup(swaggerDocument));

// app.use('/api/promotions', promotionsRouter);
// app.use('/api/ticket', ticketRouter);
// app.use('/api/transactions', transactionsRouter);

// errors handler
app.use(function(err, req, res, next) {
  logger.error(err.stack);
  res.status(500).json({message: err.message});
});

// Iniciando el servidor
app.listen(app.get('port'), () => {
  const logSqlConfig = JSON.parse(JSON.stringify(sqlConfig));
  logSqlConfig.password = 'XXXX';
  logger.debug(`connection to : ${JSON.stringify(logSqlConfig)}`);
  logger.info(`Server listening on port ${app.get('port')}`);
});
