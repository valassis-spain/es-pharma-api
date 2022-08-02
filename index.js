const express = require('express') //llamamos a Express
const app = express()

const {logger, timing} = require('./config');

//Configuraciones
app.set('port', process.env.PORT || 8080);
app.set('json spaces', 2)

//Middleware
app.use(express.urlencoded({extended: false}));
app.use(express.json());

// routes
var indexRouter = require('./routes/index');
var loginRouter = require('./routes/login');

app.use('/', indexRouter);
app.use('/authenticate', loginRouter);

// errors handler
app.use(function(err, req, res, next) {
  console.error(err.stack);
  res.status(500).json({message:err.message});
});

//Iniciando el servidor
app.listen(app.get('port'), () => {
  logger.info(`Server listening on port ${app.get('port')}`);
});

