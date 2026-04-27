const { Sequelize } = require('sequelize');
const path = require('path');

// Using SQLite for a "lighter" experience (no Docker needed)
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../database.sqlite'),
  logging: false
});

/* 
// PostgreSQL option (if you want to switch back to Docker later)
const sequelize = new Sequelize('uca_game', 'uca_admin', 'uca_password', {
  host: 'localhost',
  dialect: 'postgres',
  logging: false
});
*/

module.exports = sequelize;
