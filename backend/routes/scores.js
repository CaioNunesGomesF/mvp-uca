const express = require('express');
const router = express.Router();
const Score = require('../models/Score');
const User = require('../models/User');

// Get Top 10 (Unique Best Score Per User)
router.get('/', async (req, res) => {
  try {
    const allScores = await Score.findAll({
      order: [['km', 'DESC']],
      include: [{ model: User, attributes: ['username'] }]
    });

    const uniqueScores = [];
    const seenUsers = new Set();

    for (const score of allScores) {
      const username = score.User?.username || 'Anônimo';
      if (!seenUsers.has(username)) {
        seenUsers.add(username);
        uniqueScores.push(score);
      }
      if (uniqueScores.length >= 10) break; // Limit to Top 10
    }

    res.json(uniqueScores);
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
