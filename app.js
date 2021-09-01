const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const cookieParser = require('cookie-parser');

const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');

const User = require('./models/user');

const { port, dbURL, dbOptions, refreshSecretKey } = require('./config/config');

const { generateTokens } = require('./service/token-service');
const { getTodos } = require('./service/todos-service');


mongoose.connect(dbURL,dbOptions);
const db = mongoose.connection;
db.on('error', error => console.warn(error));
db.once('open', () => {
  console.log('Connection Succeeded')
});

const app = express();


app.use(morgan('combined'));

// отключение политики CORS
app.use(cors({
  credentials: true,
  origin: 'http://localhost:8080'
}));

//распарсить json
app.use(bodyParser.json());

app.use(cookieParser());

//инициализация passportjs в приложении
app.use(passport.initialize());

app.listen(port, function () {
  console.log('node express work on ' + port);
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const candidate = await User.findOne({email});
  const sendError = () => {
    return res
      .status(401)
      .send({
        message: 'Неверный логин/пароль',
        success: false,
      })
  };
  if(candidate) {
    const passResult = bcrypt.compareSync(password, candidate.password);
    if(passResult) {

      const { accessToken, refreshToken } = generateTokens({
        email: candidate.email,
        userId: candidate._id,
      });

      res.status(200).
        cookie('refreshToken', refreshToken, {
        maxAge: 60 * 60 * 24 * 1000,
        httpOnly: true
      }).
        send({
          accessToken,
          refreshToken,
          success: true,
          message: 'Авторизация прошла успешно',
        })
    } else {
      sendError();
    }
  } else {
    sendError();
  }
});

app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  console.log(email, password);
  const candidate = await User.findOne({email});
  if(candidate) {
    res
      .status(409)
      .send({
        success: false,
        message: 'Пользователь с данным email уже существует',
      })
  } else {
    const salt = bcrypt.genSaltSync(10);
    const pass = bcrypt.hashSync(password, salt);
    console.log('pass: ',pass);
    console.log('salt: ',salt);
    const user = new User({
      email,
      password: pass,
    });
    try {
      await user.save(function(err, user) {
        if (err) {
          res.
            status(500).
            send({
            success: false,
            message: 'Internal Server Error',
          });
          return console.error('error 328', err);
        }
        console.log("User saved successfully!", user);
        res.
        status(201).
        send({
          success: true,
          message: 'User saved successfully',
        })
      });

    } catch(e) {
      console.log(e);
//обработать ошибку
    }
  }
});

app.post('/refresh_token', (req, res) => {
  const { refreshToken } = req.cookies;
  jwt.verify(refreshToken, refreshSecretKey, function(err, decoded) {
    if(err) {
      console.error(err);
      res.status(401).
        send({
        success: false,
        message: 'Неавторизованный пользователь',
      });
    }

    const { email, userId } = decoded;

    User.findById(userId, (err, user) => {
      if(err) {
        res.status(500).
        send({
          success: false,
          message: 'Ошибка запроса к БД'
        })
      }
      if(user) {
        const { accessToken, refreshToken } = generateTokens({
          email, userId
        });

        res.status(200).
        cookie('refreshToken', refreshToken, {
          maxAge: 60 * 60 * 24 * 1000,
          httpOnly: true
        }).
        send({
          accessToken,
          refreshToken,
          success: true,
          message: 'Токены обновлены',
        })
      } else {
        res.status(401).
        send({
          success: false,
          message: 'Пользователь не найден',
        })
      }
    });
  });
});

app.get('/todos', getTodos, (req, res) => {
  const { user: { todos } } = req;
  res.status(200).send({
    todos,
    success: true,
    message: 'Список задач получен'
  })
});

app.post('/task', getTodos ,(req, res) => {
  const { user, body: { description }  } = req;
  let { todos } = user;

  if(!todos) {
    todos = []
  }
  todos.unshift({
    id: 0,
    status: false,
    description
  });
  todos.forEach((item, index) => {
    if(index === 0) return item;
    else if(todos[index - 1].id <= item.id) {
      item.id = todos[index - 1].id + 1
    }
  });
  user.save(function (err, doc) {
    if(err){
      console.error(err);
      res.status(500).send({
        message: 'Internal server error',
        success: false
      });
    }
    res.status(201).send({
      message: 'Задача создана',
      task: todos[0],
      success: true,
    })

  })
});

app.delete('/task/:id', getTodos ,(req, res) => {
  const { user, user: { todos }  } = req;
  const { id } = req.params;
  const itemIndex = todos.findIndex(({id: itemId}) => itemId === +id);


  todos.splice(itemIndex, 1);
  for(let i = itemIndex; i <= todos.length - 1; i++) {
    console.log(i);
    if(i === 0) {
      todos[0].id = 0
    } else {
      todos[i].id = todos[i - 1].id + 1;
    }
  }




  user.save(function (err, doc) {
    if(err){
      console.error(err);
      res.status(500).send({
        message: 'Internal server error',
        success: false
      });
    }
    res.status(200).send({
      message: 'Задача удалена',
      success: true,
    })

  })
});

app.post('/change_status', getTodos, (req, res) => {
  const { user, body: { id: taskId }  } = req;
  let { todos } = user;

  const taskIndex = todos.findIndex( ( {id} ) => id === taskId);
  const curStatus = todos[taskIndex].status;
  todos[taskIndex].status = !curStatus;

  user.save(function (err, doc) {
    if(err){
      console.error(err);
      res.status(500).send({
        message: 'Internal server error',
        success: false
      });
    }
    res.status(200).send({
      message: 'Статус изменен',
      status: !curStatus,
      success: true
    })

  })
});

app.post('/change_task', getTodos, (req, res) => {
  const { user, body: { id: taskId, description }  } = req;
  let { todos } = user;

  const taskIndex = todos.findIndex( ( {id} ) => id === taskId);

  todos[taskIndex].description = description;

  user.save(function (err, doc) {
    if(err){
      console.error(err);
      res.status(500).send({
        message: 'Internal server error',
        success: false
      });
    }
    res.status(200).send({
      message: 'Задача изменена',
      description,
      success: true
    })

  })
});

app.post('/replace_task', getTodos, (req, res) => {
  const { user, user: { todos }, body: { removedId, addedId } } = req;

  const removedIndex = todos.findIndex( ( {id} ) => id === removedId);
  const addedIndex = todos.findIndex( ( {id} ) => id === addedId);

  const relocatableTask = todos[removedIndex];
  todos.splice(removedIndex, 1);
  todos.splice(addedIndex, 0, relocatableTask);
  todos.forEach((task, index) => {
    task.id = index;
  });

  user.save(function (err, doc) {
    if(err){
      console.error(err);
      res.status(500).send({
        message: 'Internal server error',
        success: false
      });
    }
    res.status(200).send({
      message: 'Задача перемещена',
      success: true
    })

  })
});
