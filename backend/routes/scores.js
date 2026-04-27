const express = require('express');
const router = express.Router();
const Score = require('../models/Score');
const User = require('../models/User');

// Get Top 10
router.get('/', async (req, res) => {
  try {
    const scores = await Score.findAll({
      limit: 10,
      order: [['km', 'DESC']],
      include: [{ model: User, attributes: ['username'] }]
    });
    res.json(scores);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar placar.' });
  }
});

// Save New
router.post('/', async (req, res) => {
  try {
    const { userId, km } = req.body;
    const score = await Score.create({ UserId: userId, km });
    res.status(201).json(score);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao salvar pontuação.' });
  }
});

module.exports = router;
