const express = require('express');
const app = express();

const {logger, sqlConfig} = require('./config');

// Configuraciones
app.set('port', process.env.PORT || 8080);
app.set('json spaces', 2);

// Middleware
app.use(express.urlencoded({extended: false}));
app.use(express.json());

// routes
var indexRouter = require('./routes/index');
var loginRouter = require('./routes/login');
var tokenRouter = require('./routes/token');
var delegadoRouter = require('./routes/delegado');

app.use('/api/authenticate', function(req, res, next) {
  console.log('Request URL:', req.originalUrl);
  req.body.origin = process.env.ORIGIN_APP;
  next();
}, loginRouter);

app.use('/api/deleg/*',function(req, res, next) {
  console.log('Request URL:', req.originalUrl);
  req.body.origin = process.env.ORIGIN_DELEGADO;
  next();
});

app.use('/api/deleg/authenticate', loginRouter);
app.use('/api/deleg/delegado', delegadoRouter);
app.use('/api/token', tokenRouter);

// app.use('/api/promotions', promotionsRouter);
// app.use('/api/ticket', ticketRouter);
// app.use('/api/transactions', transactionsRouter);
app.use('/api/', indexRouter);

// errors handler
app.use(function(err, req, res, next) {
  console.error(err.stack);
  res.status(500).json({message: err.message});
});

// Iniciando el servidor
app.listen(app.get('port'), () => {
  const logSqlConfig = JSON.parse(JSON.stringify(sqlConfig));
  logSqlConfig.password = 'XXXX';
  logger.debug(`connection to : ${JSON.stringify(logSqlConfig)}`);
  logger.info(`Server listening on port ${app.get('port')}`);
});
