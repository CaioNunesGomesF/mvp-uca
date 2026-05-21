import { useState, useEffect } from 'react'
import Game from './components/Game'
import Overlay from './components/Overlay'
import './App.css'

function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('uca_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [gameState, setGameState] = useState('START') 
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(() => {
    // Load best score from localStorage on first render
    const saved = localStorage.getItem('uca_highscore')
    return saved ? parseFloat(saved) : 0
  })

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
    setScore(finalScore)

    // Always update local highscore first (works offline too)
    if (finalScore > highScore) {
      setHighScore(finalScore)
      localStorage.setItem('uca_highscore', String(finalScore))
    }
    
    if (user && user.id && user.id !== 'GUEST') {
      try {
        await fetch('http://localhost:3002/api/scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, km: finalScore / 1000 })
        });
      } catch (err) {
        console.warn("Backend offline — score salvo apenas localmente");
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
          onGameOver={(finalScore) => endGame(finalScore)} 
          score={score} 
          setScore={setScore} 
        />
      )}

      {gameState === 'GAME_OVER' && (
        <Overlay 
          type="GAME_OVER" 
          score={score}
          highScore={highScore}
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
