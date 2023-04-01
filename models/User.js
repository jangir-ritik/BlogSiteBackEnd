const { Schema, model } = require('mongoose')

const userSchema = Schema({
    username: {type: String, unique: true, required: true, min: 4},
    password: {type: String, required: true}
})

const UserModel = model('User', userSchema)

module.exports = UserModel;
