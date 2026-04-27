const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Score = sequelize.define('Score', {
  km: {
    type: DataTypes.FLOAT,
    allowNull: false
  }
});

// Relationships
User.hasMany(Score);
Score.belongsTo(User);

module.exports = Score;
