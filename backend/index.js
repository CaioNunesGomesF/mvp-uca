const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');
const authRoutes = require('./routes/auth');
const scoreRoutes = require('./routes/scores');

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', authRoutes);
app.use('/api/scores', scoreRoutes);

const PORT = 3001;

// Sync database and start
sequelize.sync().then(() => {
  app.listen(PORT, () => {
    console.log(`-----------------------------------------`);
    console.log(`  UÇÁ API ORGANIZADA (SQLITE)            `);
    console.log(`  Porta: ${PORT}                          `);
    console.log(`-----------------------------------------`);
  });
});
