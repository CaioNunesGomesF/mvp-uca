import { useState, useEffect, useRef } from 'react'

const Game = ({ onGameOver, score, setScore }) => {
  const [playerPosition, setPlayerPosition] = useState({ x: 100, y: 500 })
  const [isJumping, setIsJumping] = useState(false)
  const [velocity, setVelocity] = useState({ x: 0, y: 0 })
  const [obstacles, setObstacles] = useState([])
  const [collectibles, setCollectibles] = useState([])
  const [gameSpeed, setGameSpeed] = useState(6) // Adjusted for better initial pacing
  const [lives, setLives] = useState(3)
  const [isInvincible, setIsInvincible] = useState(false)
  const [isAttacking, setIsAttacking] = useState(false)
  const [facing, setFacing] = useState(1) // 1 for Right, -1 for Left
  const [chefX, setChefX] = useState(100) // Starts closer to the action
  const [isDashing, setIsDashing] = useState(false)
  const [canDash, setCanDash] = useState(true)
  const [isStunned, setIsStunned] = useState(false)
  const [showWarning, setShowWarning] = useState(true)
  const [dustParticles, setDustParticles] = useState([]) // For dust effects
  
  // Enhanced 8-bit Sound Generator
  const playSound = (freq, type = 'square', duration = 0.1, rampTo = null) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (rampTo) {
        osc.frequency.exponentialRampToValueAtTime(rampTo, ctx.currentTime + duration);
      }
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) { console.log("Audio not supported") }
  }


  const obstacleTimerRef = useRef(0)
  const collectibleTimerRef = useRef(0)
  const gameRef = useRef(null)
  const GRAVITY = 1.2
  const JUMP_FORCE = -22 // Stronger base jump
  const VIEWPORT_HEIGHT = 720 // Adjusted estimated height
  const GROUND_HEIGHT = 80
  const GROUND_Y = VIEWPORT_HEIGHT - GROUND_HEIGHT


  const CRAB_HEIGHT = 80
  const playerRef = useRef({ x: 100, y: GROUND_Y - CRAB_HEIGHT, vy: 0, width: 60, height: 60, facing: 1, jumps: 0 })
  const keys = useRef({})
  const catcherState = useRef(0) // 0: Idle, 1: Walk, 2: Run, 3: Jump, 4: Attack


  // Handle Controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      keys.current[e.code] = true
      if (['Space', 'KeyW', 'ArrowUp'].includes(e.code)) {
        e.preventDefault();
        performJump();
      }
      if (e.code === 'KeyQ' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        e.preventDefault();
        performDash();
      }
    }
    const handleKeyUp = (e) => (keys.current[e.code] = false)
    const handleMouseDown = (e) => {
      // Avoid triggering if clicking buttons or UI
      if (e.target.tagName !== 'BUTTON') performAttack()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('mousedown', handleMouseDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('mousedown', handleMouseDown)
    }
  }, [canDash, isDashing, facing])

  useEffect(() => {
    const timer = setTimeout(() => setShowWarning(false), 3000);
    return () => clearTimeout(timer);
  }, []);


  // Game Loop
  useEffect(() => {
    let animationId

    const update = () => {
      // 1. Full Auto-Run (Centered)
      const fixedX = 600; 
      playerRef.current.x = fixedX;
      playerRef.current.facing = 1;
      setFacing(1);

      // Dash, Stun & S-Turbo Speed Logic
      let speedMod = 0;
      if (isDashing) speedMod = 15;
      if (isStunned) speedMod = -gameSpeed * 0.5;
      
      // World speed is progression + modifiers
      const worldSpeed = Math.max(1.5, gameSpeed + speedMod);

      // (Pulo removido do loop contínuo e movido para performJump no evento keydown)

      // Physics
      if (keys.current['KeyJ'] && !isAttacking) {
        performAttack();
      }

       // Physics: Gravity & Fast Fall
       const isTurbo = keys.current['KeyS'];
       playerRef.current.vy += isTurbo ? GRAVITY * 3 : GRAVITY; // Fall 3x faster when holding S
       playerRef.current.y += playerRef.current.vy;

      // Ground collision
      if (playerRef.current.y > GROUND_Y - CRAB_HEIGHT) {
        playerRef.current.y = GROUND_Y - CRAB_HEIGHT - 15; // Raised slightly to avoid "sinking"
        playerRef.current.vy = 0;
        playerRef.current.jumps = 0; // Reset double jump
      }

      // 2. Spawn & Move Obstacles (Infinite Runner Logic)
      obstacleTimerRef.current++;
      const spawnRate = Math.max(10, 60 - (score / 20)); // Spawns even faster for more action
      
      if (obstacleTimerRef.current > spawnRate) {
        let type = 'LIXO'
        let yPos = GROUND_Y - 30
        const rand = Math.random()
        
        // Only spawn Roots now as requested
        type = 'RAIZ'
        yPos = GROUND_Y - 75 

        // Group Spawn Logic: Max 2 roots as requested
        const groupSize = Math.random() > 0.7 ? 2 : 1;
        const newGroup = [];
        
        for (let i = 0; i < groupSize; i++) {
          newGroup.push({
            id: Date.now() + Math.random(), // Guaranteed unique
            x: 1000 + (i * 250), // Increased spacing for "landing room"
            y: yPos,
            type: type,
            width: type === 'RAIZ' ? 80 : 50,
            height: type === 'RAIZ' ? 80 : 50,
            speed: worldSpeed 
          });
        }

        setObstacles(prev => [...prev, ...newGroup]);
        obstacleTimerRef.current = 0;
      }

      // 3. Spawn Collectibles
      collectibleTimerRef.current++;
      if (collectibleTimerRef.current > 150) {
        setCollectibles(prev => [...prev, {
          id: Date.now(),
          x: 1200,
          y: GROUND_Y - 60 // Low and reachable
        }])
        collectibleTimerRef.current = 0
      }

      // 4. Update Game State
      setObstacles(prev => {
        const updated = prev.map(o => ({ ...o, x: o.x - worldSpeed }))
          .filter(o => {
            // Center the hitbox on the crab (Crab is 80px wide)
            const hitBoxX = playerRef.current.x + 10
            const hitBoxWidth = isAttacking ? 110 : 60

            // NEW TIGHT HITBOX (Fairness for the Roots)
            const obHitX = o.type === 'RAIZ' ? o.x + 25 : o.x + 5;
            const obHitW = o.type === 'RAIZ' ? 30 : 40;
            const obHitY = o.type === 'RAIZ' ? o.y + 30 : o.y + 10;
            const obHitH = o.type === 'RAIZ' ? 50 : 40;

            const isColliding = (
              hitBoxX < obHitX + obHitW &&
              hitBoxX + hitBoxWidth > obHitX &&
              playerRef.current.y + 15 < obHitY + obHitH &&
              playerRef.current.y + 65 > obHitY
            )


            if (isColliding) {
              if (isAttacking) {
                // Destroy obstacle
                setScore(s => s + 50)
                playSound(150, 'sawtooth', 0.1); // Hit/Break sound
                return false // Remove obstacle
              } else if (!isInvincible && !isDashing) {
                handleDamage()
                return false // Obstacle breaks after hitting you too
              }
            }
            return o.x > -100
          })
        return updated
      })



      setCollectibles(prev => {
        const updated = prev.map(c => ({ ...c, x: c.x - worldSpeed }))
          .filter(c => {
            const collected = (
              playerRef.current.x < c.x + 40 &&
              playerRef.current.x + 70 > c.x &&
              playerRef.current.y < c.y + 40 &&
              playerRef.current.y + 70 > c.y
            )
            if (collected) setScore(s => s + 10)
            return c.x > -100 && !collected
          })
        return updated
      })

      // Score increases automatically as you "run"
      setScore(s => s + (worldSpeed / 10));

      setPlayerPosition({ x: playerRef.current.x, y: playerRef.current.y })
      
      // Spawn Dust Particles
      if (Math.random() > 0.7) {
        setDustParticles(prev => [...prev.slice(-20), {
          id: Date.now() + Math.random(),
          x: playerRef.current.x + 20,
          y: playerRef.current.y + 60
        }]);
      }
      if (Math.random() > 0.8) {
        setDustParticles(prev => [...prev.slice(-20), {
          id: Date.now() + Math.random(),
          x: chefX + 60,
          y: GROUND_Y - 30
        }]);
      }
      setDustParticles(prev => prev.filter(p => Date.now() - p.id < 500));

      // Chef/Catcher Chase Logic (BALANCED)
      setChefX(prev => {
        // Catcher is steady but slightly slower to allow recovery
        const catcherWorldSpeed = gameSpeed - 0.6; 
        
        // Relative speed is how fast he moves on screen based on the difference
        let relativeSpeed = catcherWorldSpeed - worldSpeed;
        
        // If dashing, he falls back even more
        if (isDashing) relativeSpeed -= 5;

        let nextX = prev + relativeSpeed;

        // Determine animation state based on distance
        const dist = playerRef.current.x - nextX;
        let stateIndex = 2; // Run
        if (dist > 500) stateIndex = 1; // Walk
        if (dist < 100) stateIndex = 4; // Attack
        catcherState.current = stateIndex;

        // Hard limits: Keep him visible on screen
        if (nextX < 50) nextX = 50; 

        // Collision Logic
        if (nextX >= playerRef.current.x - 40) {
          handleDamage();
          return playerRef.current.x - 400; // Pushed back after hitting you
        }
        
        return nextX;
      });

      setGameSpeed(s => Math.min(s + 0.003, 20)) // Balanced acceleration curve
      animationId = requestAnimationFrame(update)
    }

    animationId = requestAnimationFrame(update)
    return () => cancelAnimationFrame(animationId)
  }, [gameSpeed, onGameOver, setScore, score, isInvincible, lives, facing, isDashing])


  const handleDamage = () => {
    if (isInvincible || isAttacking || isDashing) return
    
    setLives(prev => {
      const newLives = prev - 1
      if (newLives <= 0) {
        onGameOver()
      }
      return newLives
    })
    
    setIsInvincible(true)
    setIsStunned(true)
    
    setTimeout(() => setIsInvincible(false), 1500)
    setTimeout(() => setIsStunned(false), 2000) // Stun duration

    // IMPACT: Catcher lunges forward immediately on hit
    setChefX(prev => Math.min(prev + 100, playerRef.current.x - 80));
  }

  const performJump = () => {
    if (playerRef.current.jumps < 2) {
      playerRef.current.vy = JUMP_FORCE
      playerRef.current.jumps += 1
      playSound(200 + (playerRef.current.jumps * 50), 'square', 0.2, 600); // Boing effect
    }
  }

  const performAttack = () => {
    setIsAttacking(true)
    setTimeout(() => setIsAttacking(false), 300) // Attack duration
  }

  const performDash = () => {
    if (!canDash) return
    
    if (isStunned) setIsStunned(false); // Dashing clears stun
    setIsDashing(true)
    setCanDash(false)
    playSound(600, 'sine', 0.2, 200); // Slide-down dash effect
    
    // Dash duration
    setTimeout(() => {
      setIsDashing(false)
    }, 200)

    // Dash cooldown
    setTimeout(() => {
      setCanDash(true)
    }, 1000)
  }


  return (
    <div className="game-viewport" ref={gameRef}>
      {/* 1. SCENARIO AREA (Sky, Trees, Action) */}
      <div className="scenario-area">
        {/* Simple Infinite Background */}
        <div 
          className="parallax-bg" 
          style={{ 
            backgroundPositionX: `${(score * -0.5) % 1024}px`,
          }} 
        />
        
        <div className="hud">
          <div className="heart-container">
            {[...Array(3)].map((_, i) => (
              <div key={i} className={`heart-life ${i >= lives ? 'lost' : ''}`} />
            ))}
          </div>

          <div className="score-badge">
            { (score / 1000).toFixed(2) } KM
          </div>
        </div>

        <div className="abilities-container">
          <div className={`dash-indicator ${!canDash ? 'cooldown' : ''}`}>
            <div className="ability-key">Q</div>
            <div className="ability-info">
              <span className="ability-name">DASH</span>
              <span className="ability-status">{canDash ? 'PRONTO' : 'RECARREGANDO'}</span>
            </div>
            {!canDash && <div className="cooldown-bar" style={{ animationDuration: '1s' }} />}
          </div>

          <div className="dash-indicator ability-jump">
            <div className="ability-key">W</div>
            <div className="ability-info">
              <span className="ability-name">PULO DUPLO</span>
              <span className="ability-status">ATIVO</span>
            </div>
          </div>
        </div>

        {showWarning && score < 10 && (
          <div className="warning-indicator">🚨 FUJA DO CATADOR! 🚨</div>
        )}

        {/* Chef Boss Sprite - Full Opaque Clean Sprite */}
        <div 
          className="chef-boss" 
          key={`catcher-${playerRef.current.x - chefX > 350 ? 'walk' : 'run'}`} 
          style={{ 
            position: 'absolute', 
            left: chefX, 
            top: GROUND_Y - 172, 
            backgroundImage: 'url("/catador_spritesheet_clean.png")',
            zIndex: 15,
            opacity: 1,
            backgroundSize: '640px 640px',
            backgroundPositionY: `-${(playerRef.current.x - chefX > 350 ? 0 : playerRef.current.x - chefX < 70 ? 2 : 1) * 160}px`,
            animation: `catcher-run ${Math.max(0.2, 0.6 - (gameSpeed - 5) * 0.05)}s steps(4) infinite`
          }} 
        />

        {/* Dust Particles */}
        {dustParticles.map(p => (
          <div 
            key={p.id} 
            className="dust-particle" 
            style={{ left: p.x, top: p.y }} 
          />
        ))}

        {/* Player: Uçá */}
        <div style={{
          position: 'absolute',
          left: playerPosition.x,
          top: playerPosition.y,
          width: '80px',
          height: '80px',
          zIndex: 10,
          opacity: isInvincible ? (Math.sin(Date.now() / 50) > 0 ? 1 : 0.3) : 1,
          animation: `crab-run-tilt ${Math.max(0.1, 0.4 - (gameSpeed - 5) * 0.03)}s infinite alternate ease-in-out`
        }}>
          <img 
            src={isAttacking ? "/uca_crab_attack.png" : "/uca_crab.png"} 
            className={`uca-crab ${isAttacking ? 'attacking' : ''} ${isDashing ? 'dashing' : ''} ${isStunned ? 'stunned' : ''}`}
            style={{
              width: '100%',
              height: '100%',
              transform: `scaleX(${facing})`,
              opacity: isInvincible ? 0.5 : 1,
              filter: isDashing 
                ? 'brightness(1.5) contrast(1.2) drop-shadow(0 0 10px white)' 
                : (isStunned ? 'sepia(1) saturate(2) hue-rotate(-50deg)' : 'none')
            }} 
            alt="Uçá"
          />
          
          {/* Wind Slash Effect */}
          {isAttacking && (
            <div 
              className="slash-effect" 
              style={{
                top: '-20px',
                left: facing === 1 ? '60px' : '-60px',
                transform: `scaleX(${facing})`
              }}
            />
          )}

        </div>



        {/* Shadow under the crab - now relative to scenario bottom */}
        <div style={{
          position: 'absolute',
          left: playerPosition.x + 10,
          bottom: -5,
          width: '60px',
          height: '10px',
          background: 'rgba(0,0,0,0.4)',
          borderRadius: '50%',
          zIndex: 2,
          transform: `scale(${1 - (GROUND_Y - 80 - playerPosition.y) / 200})`
        }} />

        {/* Obstacles (Now Pixel Art) */}
        {obstacles.map(o => {
          let bgPos = '0% 0%'
          let bgImg = 'url("/items_spritesheet.png")'
          let bgSize = '300% 300%'

          if (o.type === 'RAIZ') {
            bgImg = 'url("/mangrove_root.png")'
            bgSize = 'contain'
            bgPos = 'center'
          } else if (o.type === 'PEDRA') {
            bgPos = '0% 0%'
          } else if (o.type === 'LIXO') {
            bgPos = '50% 0%'
          }
          
          return (
            <div key={o.id} style={{
              position: 'absolute',
              left: o.x,
              top: o.y,
              width: o.width,
              height: o.height,
              backgroundImage: bgImg,
              backgroundSize: bgSize,
              backgroundPosition: bgPos,
              backgroundRepeat: 'no-repeat',
              imageRendering: 'pixelated',
              zIndex: 5
            }} />
          )
        })}

        {/* Collectibles (Now Pixel Art) */}
        {collectibles.map(c => (
          <div 
            key={c.id}
            style={{
              position: 'absolute',
              left: c.x,
              top: c.y,
              width: '60px',
              height: '60px',
              backgroundImage: 'url("/items_spritesheet.png")',
              backgroundSize: '300% 300%',
              backgroundPosition: '0% 100%', // Bottom-left: Barco de Fogo
              backgroundRepeat: 'no-repeat',
              imageRendering: 'pixelated',
              zIndex: 5
            }}
          />
        ))}
      </div>

      {/* 2. GROUND AREA (Solid Mud) */}
      <div 
        className="ground-area"
        style={{ 
          backgroundPositionX: `${(score * -4) % 1024}px` 
        }}
      >
      </div>
    </div>
  )
}

export default Game

