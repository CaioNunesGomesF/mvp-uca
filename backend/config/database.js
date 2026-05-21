const { Sequelize } = require('sequelize');
const path = require('path');

const dialect = process.env.DB_DIALECT || 'sqlite';
const host = process.env.DB_HOST || 'localhost';

let sequelize;

if (dialect === 'postgres') {
  // Production / Docker with persistent PostgreSQL
  sequelize = new Sequelize('uca_game', 'uca_admin', 'uca_password', {
    host: host,
    dialect: 'postgres',
    logging: false
  });
} else {
  // Local Development with lightweight SQLite
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../database.sqlite'),
    logging: false
  });
}

module.exports = sequelize;
