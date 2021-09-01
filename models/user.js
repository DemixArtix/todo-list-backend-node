const mongoose = require('mongoose');
const Schema = mongoose.Schema;


const UserSchema = new Schema({
    email: {
      type:String,
      required: true,
      unique: true,
      index: true,
      validate: {
        validator: function(value) {
          const mailPattern = /.+@.+\..+/i;
          const mailRegExp = new RegExp(mailPattern);
          return value.match(mailRegExp);
        },
        message: props => `${props.value} is not a valid Email`
      }
    },
    password: {
      type:String,
      required: true,
    },
    todos: [
      {
        _id: Schema.Types.ObjectId,
        id: {
          type: Number,
          index: true
        },
        status: Boolean,
        description: String,
      }
    ]
  },
  {collection: 'users'}
);

const User = mongoose.model('User', UserSchema);

module.exports = User;

