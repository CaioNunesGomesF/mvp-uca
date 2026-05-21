import React, { useState, useEffect } from 'react'

const Overlay = ({ type, score, onStart, onRestart, onShowScoreboard, onBack, highScore, onLoginSuccess, username, isGuest, onLogout, onGoToAuth }) => {
  const [nameInput, setNameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [scores, setScores] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch real scores from API, fallback to localStorage when offline
  useEffect(() => {
    if (type === 'SCOREBOARD') {
      setIsLoading(true);
      fetch('http://localhost:3002/api/scores')
        .then(res => res.json())
        .then(data => {
          let apiScores = Array.isArray(data) ? data : [];
          
          // Get local highscore
          const localBest = localStorage.getItem('uca_highscore')
          const localUser = localStorage.getItem('uca_user')
          const userName = localUser ? JSON.parse(localUser).username : 'Você'
          
          if (localBest) {
            const localKm = parseFloat(localBest) / 1000
            
            // Check if this username is already in the API scores list
            const isAlreadyInApi = apiScores.some(entry => entry.User?.username === userName)
            
            if (!isAlreadyInApi && localKm > 0) {
              // Add the local score to the ranking
              apiScores.push({
                km: localKm,
                User: { username: userName },
                local: true
              })
              // Re-sort ranking list descending
              apiScores.sort((a, b) => b.km - a.km)
            }
          }
          
          setScores(apiScores);
          setIsLoading(false);
        })
        .catch(() => {
          // Backend offline — show local best score from localStorage
          const localBest = localStorage.getItem('uca_highscore')
          const localUser = localStorage.getItem('uca_user')
          const userName = localUser ? JSON.parse(localUser).username : 'Você'
          if (localBest) {
            setScores([{ km: parseFloat(localBest) / 1000, User: { username: userName }, local: true }])
          } else {
            setScores([])
          }
          setIsLoading(false);
        });
    }
  }, [type]);

  const handleAuth = async () => {
    if (!nameInput || !passwordInput) {
      setError('Preencha todos os campos, caranguejo!');
      return;
    }

    setError('');
    setIsLoading(true);
    const endpoint = isRegistering ? 'register' : 'login';
    
    try {
      const response = await fetch(`http://localhost:3002/api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: nameInput, password: passwordInput })
      });

      const data = await response.json();
      if (response.ok) {
        onLoginSuccess(data);
      } else {
        setError(data.error || 'Erro na autenticação');
      }
    } catch (err) {
      setError('Manguezal offline. Verifique o servidor!');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`overlay-primo ${type.toLowerCase()}`}>
      
      {type === 'GAME_OVER' && (
        <video 
          autoPlay 
          loop 
          muted 
          playsInline 
          className="gameover-video-bg"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: 0,
            opacity: 0.7,
            pointerEvents: 'none'
          }}
        >
          <source src="/gameover.mp4" type="video/mp4" />
        </video>
      )}
      
      {/* Dynamic Background Elements */}
      <div className="blobs-container">
        <div className="light-blob b1"></div>
        <div className="light-blob b2"></div>
        <div className="light-blob b3"></div>
      </div>

      <div className="pulse-container">
        <div className="pulse-wave w1"></div>
        <div className="pulse-wave w2"></div>
        <div className="pulse-wave w3"></div>
      </div>

      <div className="dust-container">
        <div className="particle p1"></div>
        <div className="particle p2"></div>
        <div className="particle p3"></div>
      </div>
      
      <div className="primo-content">
        {type === 'USER_SETUP' ? (
          <div className="auth-card-container">
            <div className="auth-hero">
              <div className="auth-crab-sprite" />
            </div>
            
            <div className="setup-card premium">
              <div className="auth-header">
                <h2>{isRegistering ? 'NOVO MEMBRO' : 'BEM-VINDO DE VOLTA'}</h2>
                <p>{isRegistering ? 'Crie sua conta para salvar recordes' : 'Acesse seu perfil do manguezal'}</p>
              </div>
              
              {error && <div className="auth-error pulse-error">{error}</div>}

              <div className="input-group">
                <input 
                  type="text" 
                  placeholder="USUÁRIO" 
                  className="primo-input"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                />
                <input 
                  type="password" 
                  placeholder="SENHA" 
                  className="primo-input"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                />
              </div>

              <button className="pill-btn primary large" onClick={handleAuth} disabled={isLoading}>
                {isLoading ? 'PROCESSANDO...' : (isRegistering ? 'CADASTRAR CONTA' : 'FAZER LOGIN')}
              </button>

              <div className="auth-footer">
                <button className="text-btn highlight" onClick={() => setIsRegistering(!isRegistering)}>
                  {isRegistering ? 'JÁ TENHO UMA CONTA' : 'CRIAR NOVA CONTA'}
                </button>
                <button className="text-btn" onClick={onBack}>VOLTAR AO MENU</button>
              </div>
            </div>
          </div>
        ) : type === 'SCOREBOARD' ? (
          <div className="scoreboard-view premium">
            <div className="primo-logo small">RANKING GLOBAL</div>
            {scores[0]?.local && (
              <div style={{ fontSize: '8px', color: 'rgba(255,200,50,0.7)', fontFamily: "'Press Start 2P', cursive", marginBottom: '8px', letterSpacing: '1px' }}>
                ⚠ SERVIDOR OFFLINE — RECORDE LOCAL
              </div>
            )}
            <div className="scoreboard-list">
              {isLoading ? (
                <div className="loading-text">CARREGANDO...</div>
              ) : (
                scores.map((entry, idx) => (
                  <div key={idx} className={`score-item ${entry.User?.username === username ? 'highlight' : ''}`}>
                    <span className="rank">{idx + 1}</span>
                    <span className="name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {entry.User?.username || 'Anônimo'}
                      {entry.local && (
                        <span style={{ 
                          fontSize: '8px', 
                          background: 'rgba(255, 193, 7, 0.15)', 
                          color: '#ffc107', 
                          padding: '1px 5px', 
                          borderRadius: '3px', 
                          border: '1px solid rgba(255, 193, 7, 0.35)', 
                          fontFamily: "'Press Start 2P', cursive",
                          letterSpacing: '0px'
                        }}>
                          LOCAL
                        </span>
                      )}
                    </span>
                    <span className="km">{entry.km?.toFixed(2)} KM</span>
                  </div>
                ))
              )}
              {!isLoading && scores.length === 0 && <div className="no-scores">NENHUM RECORDE AINDA</div>}
            </div>
            <button className="pill-btn primary" onClick={onBack}>VOLTAR AO MENU</button>
          </div>
        ) : (
          <div className="main-menu-view">
            <div className="primo-logo-group">
              <div className="primo-logo">UÇÁ</div>
              <div className="logo-subtitle">A REBELIÃO DA CARAPAÇA</div>
            </div>
            
            {username && (
              <div className="user-badge">
                <span className="badge-label">{isGuest ? 'VISITANTE' : 'LOGADO COMO'}</span>
                <span className="badge-name">{username.toUpperCase()}</span>
              </div>
            )}

            <div className="primo-menu-btns">
              <button className="pill-btn primary large" onClick={type === 'GAME_OVER' ? onRestart : onStart}>
                {type === 'START' ? 'JOGAR' : 'RECOMEÇAR'}
              </button>
              
              <div className="sub-menu-row">
                <button className="pill-btn glass" onClick={onShowScoreboard}>PLACAR</button>
                {!username || isGuest ? (
                  <button className="pill-btn highlight" onClick={onGoToAuth}>ENTRAR</button>
                ) : (
                  <button className="pill-btn outline" onClick={onLogout}>SAIR</button>
                )}
              </div>
              
              {type === 'GAME_OVER' && (
                <div className="game-over-stats">
                  <div className="primo-go-title">VOCÊ CORREU</div>
                  <div className="primo-go-stat">{(score / 1000).toFixed(2)} KM</div>
                  {highScore > 0 && (
                    <div className="primo-go-record">
                      {score >= highScore
                        ? <span className="record-new">🏆 NOVO RECORDE!</span>
                        : <span className="record-best">RECORDE: {(highScore / 1000).toFixed(2)} KM</span>
                      }
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="primo-version-badge">v.1.2.0 PREMIUM AUTH</div>
    </div>
  )
}

export default Overlay
