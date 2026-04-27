import { useState, useEffect } from 'react'
import Game from './components/Game'
import Overlay from './components/Overlay'
import './App.css'

function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('uca_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Start at START menu if we have a user, otherwise START menu too (but with login option)
  const [gameState, setGameState] = useState('START') 
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)

  useEffect(() => {
    if (user) {
      localStorage.setItem('uca_user', JSON.stringify(user));
    }
  }, [user])

  const startGame = () => {
    setScore(0)
    setGameState('PLAYING')
  }

  const endGame = async (finalScore) => {
    setGameState('GAME_OVER')
    
    if (user && user.id && user.id !== 'GUEST') {
      try {
        await fetch('http://localhost:3001/api/scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, km: finalScore / 1000 })
        });
      } catch (err) {
        console.error("Erro ao salvar no banco", err);
      }
    }
  }

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setGameState('START');
  }

  const handleGuest = () => {
    if (!user) {
      const guestName = `Visitante_${Math.floor(Math.random() * 999)}`;
      setUser({ username: guestName, id: 'GUEST' });
    }
    startGame();
  }

  const showScoreboard = () => setGameState('SCOREBOARD')
  const backToMenu = () => setGameState('START')
  const goToAuth = () => setGameState('USER_SETUP')

  return (
    <div className="app-container">
      {gameState === 'USER_SETUP' && (
        <Overlay 
          type="USER_SETUP" 
          onLoginSuccess={handleLoginSuccess}
          onBack={backToMenu}
        />
      )}

      {gameState === 'START' && (
        <Overlay 
          type="START" 
          username={user?.username}
          isGuest={user?.id === 'GUEST'}
          onStart={user ? startGame : handleGuest} 
          onShowScoreboard={showScoreboard}
          onGoToAuth={goToAuth}
          onLogout={() => {
            localStorage.removeItem('uca_user');
            setUser(null);
          }}
        />
      )}
      
      {gameState === 'PLAYING' && (
        <Game 
          onGameOver={() => endGame(score)} 
          score={score} 
          setScore={setScore} 
        />
      )}

      {gameState === 'GAME_OVER' && (
        <Overlay 
          type="GAME_OVER" 
          score={score} 
          onRestart={startGame} 
          onShowScoreboard={showScoreboard}
          username={user?.username}
          onBack={backToMenu}
        />
      )}

      {gameState === 'SCOREBOARD' && (
        <Overlay 
          type="SCOREBOARD" 
          onBack={backToMenu}
          username={user?.username}
        />
      )}
    </div>
  )
}

export default App
