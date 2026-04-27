import { useState, useEffect, useRef } from 'react'

const Game = ({ onGameOver, score, setScore }) => {
  const [playerPosition, setPlayerPosition] = useState({ x: 100, y: 500 })
  const [isJumping, setIsJumping] = useState(false)
  const [velocity, setVelocity] = useState({ x: 0, y: 0 })
  const [obstacles, setObstacles] = useState([])
  const [collectibles, setCollectibles] = useState([])
  const [gameSpeed, setGameSpeed] = useState(7)
  const [lives, setLives] = useState(3)
  const [isInvincible, setIsInvincible] = useState(false)
  const [isAttacking, setIsAttacking] = useState(false)
  const [facing, setFacing] = useState(1) // 1 for Right, -1 for Left
  const [chefX, setChefX] = useState(-50) // Starts slightly on screen/edge
  const [showWarning, setShowWarning] = useState(true)
  const [dustParticles, setDustParticles] = useState([]) // For dust effects


  
  const gameRef = useRef(null)
  const GRAVITY = 0.8
  const JUMP_FORCE = -15
  const VIEWPORT_HEIGHT = 720 // Adjusted estimated height
  const GROUND_HEIGHT = 80
  const GROUND_Y = VIEWPORT_HEIGHT - GROUND_HEIGHT


  const CRAB_HEIGHT = 80
  const playerRef = useRef({ x: 100, y: GROUND_Y - CRAB_HEIGHT, vy: 0, width: 60, height: 60, facing: 1 })
  const keys = useRef({})
  const catcherState = useRef(0) // 0: Idle, 1: Walk, 2: Run, 3: Jump, 4: Attack


  // Handle Controls
  useEffect(() => {
    const handleKeyDown = (e) => (keys.current[e.code] = true)
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
  }, [])


  // Game Loop
  useEffect(() => {
    let animationId
    let obstacleTimer = 0
    let collectibleTimer = 0

    const update = () => {
      // 1. Move Player
      if (keys.current['ArrowLeft'] || keys.current['KeyA']) {
        playerRef.current.x -= 10
        playerRef.current.facing = -1
        setFacing(-1)
      }
      if (keys.current['ArrowRight'] || keys.current['KeyD']) {
        playerRef.current.x += 10
        playerRef.current.facing = 1
        setFacing(1)
      }


      if ((keys.current['Space'] || keys.current['KeyW'] || keys.current['ArrowUp']) && playerRef.current.y >= GROUND_Y - CRAB_HEIGHT) {
        playerRef.current.vy = JUMP_FORCE
      }

      // ATTACK
      if (keys.current['KeyJ'] && !isAttacking) {
        performAttack()
      }

      // Physics

      playerRef.current.vy += GRAVITY
      playerRef.current.y += playerRef.current.vy

      // Ground collision
      if (playerRef.current.y > GROUND_Y - CRAB_HEIGHT) {
        playerRef.current.y = GROUND_Y - CRAB_HEIGHT
        playerRef.current.vy = 0
      }



      // Constrain player
      if (playerRef.current.x < 0) playerRef.current.x = 0
      if (playerRef.current.x > 1140) playerRef.current.x = 1140

      // 2. Spawn & Move Obstacles (Infinite Runner Logic)
      obstacleTimer++
      const spawnRate = Math.max(20, 100 - (score / 10)) // Spawns faster as score increases
      
      if (obstacleTimer > spawnRate) {
        let type = 'LIXO'
        let yPos = GROUND_Y - 30
        const rand = Math.random()
        
        // Dynamic variety based on progression
        if (score < 50) {
          type = rand > 0.4 ? 'COCO' : 'LIXO'
        } else if (score < 150) {
          type = rand > 0.6 ? 'FAISCA' : (rand > 0.3 ? 'LIXO' : 'COCO')
        } else {
          // Chaos mode: everything is possible
          if (rand > 0.8) type = 'CHEF' // Actually 🔪 knife
          else if (rand > 0.6) type = 'FAISCA'
          else if (rand > 0.3) type = 'COCO'
          else type = 'LIXO'
        }

        // Adjust yPos based on type
        if (type === 'COCO') yPos = 100 + Math.random() * 150 // Flying high
        if (type === 'FAISCA') yPos = 80 // Mid height
        if (type === 'CHEF' || type === 'LIXO') yPos = GROUND_Y - 30 // Grounded

        setObstacles(prev => [...prev, {
          id: Date.now(),
          x: 1200,
          y: yPos,
          type,
          speed: gameSpeed + (score / 200) // Increase obstacle speed with score
        }])
        obstacleTimer = 0
      }

      // 3. Spawn Collectibles
      collectibleTimer++
      if (collectibleTimer > 150) {
        setCollectibles(prev => [...prev, {
          id: Date.now(),
          x: 1200,
          y: GROUND_Y - 100 - Math.random() * 100,
          speed: gameSpeed
        }])
        collectibleTimer = 0
      }

      // 4. Update Game State
      setObstacles(prev => {
        const updated = prev.map(o => ({ ...o, x: o.x - o.speed }))
          .filter(o => {
            const hitBoxX = facing === 1 ? playerRef.current.x + 40 : playerRef.current.x - 60
            const hitBoxWidth = isAttacking ? 120 : 60

            const isColliding = (
              hitBoxX < o.x + 60 &&
              hitBoxX + hitBoxWidth > o.x &&
              playerRef.current.y < o.y + 60 &&
              playerRef.current.y + 100 > o.y
            )


            if (isColliding) {
              if (isAttacking) {
                // Destroy obstacle
                setScore(s => s + 50)
                return false // Remove obstacle
              } else if (!isInvincible) {
                handleDamage()
              }
            }
            return o.x > -100
          })
        return updated
      })



      setCollectibles(prev => {
        const updated = prev.map(c => ({ ...c, x: c.x - c.speed }))
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
      setScore(s => s + (gameSpeed / 10));

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

      // Chef/Catcher Chase Logic (BALANCED BUT AGGRESSIVE)
      setChefX(prev => {
        const targetX = -40; // Keeps him partially visible on the left edge
        const distToPlayer = playerRef.current.x - prev;
        
        // Determine animation state
        let stateIndex = 2; // Running
        if (distToPlayer > 350) stateIndex = 1; // Walking far away
        if (distToPlayer < 70) stateIndex = 4; // Attacking
        catcherState.current = stateIndex;

        let nextX = prev;
        
        if (prev > targetX) {
          nextX -= 0.4; // Slow retreat (was 0.3)
        } else if (prev < targetX) {
          nextX += 1.2; // FASTER approach to stay threatening (was 0.5)
        }

        // Collision Logic
        if (nextX >= playerRef.current.x - 40) {
          handleDamage();
          return playerRef.current.x - 220; 
        }
        
        return nextX;
      });

      setGameSpeed(s => Math.min(s + 0.005, 20))
      animationId = requestAnimationFrame(update)
    }

    animationId = requestAnimationFrame(update)
    return () => cancelAnimationFrame(animationId)
  }, [gameSpeed, onGameOver, setScore, score, isInvincible, lives, facing])


  const handleDamage = () => {
    if (isInvincible || isAttacking) return
    
    setLives(prev => {
      const newLives = prev - 1
      if (newLives <= 0) {
        onGameOver()
      }
      return newLives
    })
    
    setIsInvincible(true)
    setTimeout(() => setIsInvincible(false), 1500)

    // IMPACT: Catcher lunges forward when you mess up!
    setChefX(prev => Math.min(prev + 100, playerRef.current.x - 70));
  }

  const performAttack = () => {
    setIsAttacking(true)
    setTimeout(() => setIsAttacking(false), 300) // Attack duration
  }


  return (
    <div className="game-viewport" ref={gameRef}>
      {/* 1. SCENARIO AREA (Sky, Trees, Action) */}
      <div className="scenario-area">
        {/* Parallax Background - Scaled by gameSpeed */}
        <div 
          className="parallax-bg" 
          style={{ 
            transform: `translateX(${(score * -4) % 1024}px)`,
            filter: score > 3000 ? 'hue-rotate(240deg) brightness(0.8)' : (score > 1000 ? 'grayscale(0.5) contrast(1.2)' : 'none'),
            transition: 'filter 2s'
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
            className={`uca-crab ${isAttacking ? 'attacking' : ''}`}
            style={{
              width: '100%',
              height: '100%',
              transform: `scaleX(${facing})`,
              opacity: isInvincible ? 0.5 : 1
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
          let bgPos = '0% 0%'; // COCO
          if (o.type === 'LIXO') bgPos = '50% 0%';
          if (o.type === 'FAISCA') bgPos = '100% 0%';
          if (o.type === 'CHEF') bgPos = '50% 50%';

          return (
            <div 
              key={o.id}
              style={{
                position: 'absolute',
                left: o.x,
                top: o.y,
                width: '60px',
                height: '60px',
                backgroundImage: 'url("/items_spritesheet.png")',
                backgroundSize: '300% 300%',
                backgroundPosition: bgPos,
                backgroundRepeat: 'no-repeat',
                imageRendering: 'pixelated',
                mixBlendMode: 'screen',
                filter: o.type === 'FAISCA' ? 'drop-shadow(0 0 10px #fbbf24) brightness(1.2)' : 'none',
                zIndex: 5
              }}
            />
          );
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
              mixBlendMode: 'screen',
              filter: 'drop-shadow(0 0 10px #fbbf24) brightness(1.2)',
              zIndex: 5
            }}
          />
        ))}
      </div>

      {/* 2. GROUND AREA (Solid Mud) */}
      <div 
        className="ground-area"
        style={{ 
          backgroundPositionX: `${(score * -8) % 1024}px` 
        }}
      >
      </div>
    </div>
  )
}

export default Game

