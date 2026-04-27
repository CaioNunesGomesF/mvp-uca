const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.create({ username, password });
    res.status(201).json({ id: user.id, username: user.username });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Este nome já está em uso no mangue!' });
    }
    res.status(500).json({ error: 'Erro ao criar conta.' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ where: { username } });
    
    if (!user || !(await user.validPassword(password))) {
      return res.status(401).json({ error: 'Nome ou senha incorretos.' });
    }

    res.json({ id: user.id, username: user.username });
  } catch (error) {
    res.status(500).json({ error: 'Erro no login.' });
  }
});

module.exports = router;
