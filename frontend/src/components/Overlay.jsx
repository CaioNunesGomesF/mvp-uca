import React, { useState, useEffect } from 'react'

const Overlay = ({ type, score, onStart, onRestart, onShowScoreboard, onBack, highScore, onLoginSuccess, username, isGuest, onLogout, onGoToAuth }) => {
  const [nameInput, setNameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [scores, setScores] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch real scores from API
  useEffect(() => {
    if (type === 'SCOREBOARD') {
      setIsLoading(true);
      fetch('http://localhost:3001/api/scores')
        .then(res => res.json())
        .then(data => {
          setScores(Array.isArray(data) ? data : []);
          setIsLoading(false);
        })
        .catch(err => {
          console.error("Erro ao carregar placar", err);
          setIsLoading(false);
          setScores([]); // Fallback to empty list
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
      const response = await fetch(`http://localhost:3001/api/${endpoint}`, {
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
              <img src="/uca_crab.png" alt="Uça Hero" />
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
            <div className="scoreboard-list">
              {isLoading ? (
                <div className="loading-text">CARREGANDO...</div>
              ) : (
                scores.map((entry, idx) => (
                  <div key={idx} className={`score-item ${entry.User?.username === username ? 'highlight' : ''}`}>
                    <span className="rank">{idx + 1}</span>
                    <span className="name">{entry.User?.username || 'Anônimo'}</span>
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
              <button className="pill-btn primary large" onClick={onStart}>
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
