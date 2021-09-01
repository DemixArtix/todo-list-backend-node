const passport = require('passport');
require('../middleware/passport')(passport);

class TodosService {
  getTodos = function (req, res, next) {
    return passport.authenticate('jwt', {session: false}, (err, user) => {

      if(err) {
        return next(err);
      }
      req.user = user;
      next()
    })(req, res, next)
  }
}

module.exports = new TodosService();