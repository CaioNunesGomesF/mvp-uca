import { useState, useEffect, useRef } from 'react'

const Game = ({ onGameOver, score, setScore }) => {
  const [playerPosition, setPlayerPosition] = useState({ x: 100, y: 500 })
  const [isJumping, setIsJumping] = useState(false)
  const [velocity, setVelocity] = useState({ x: 0, y: 0 })
  const [obstacles, setObstacles] = useState([])
  const [collectibles, setCollectibles] = useState([])
  const [gameSpeed, setGameSpeed] = useState(6)
  const [lives, setLives] = useState(3)
  const [isInvincible, setIsInvincible] = useState(false)
  const [isAttacking, setIsAttacking] = useState(false)
  const [facing, setFacing] = useState(1)
  const [chefX, setChefX] = useState(100)
  const [isDashing, setIsDashing] = useState(false)
  const [canDash, setCanDash] = useState(true)
  const [isStunned, setIsStunned] = useState(false)
  const [showWarning, setShowWarning] = useState(true)
  const [dustParticles, setDustParticles] = useState([])
  const [blinkOn, setBlinkOn] = useState(true)

  // Blink timer for invincibility
  useEffect(() => {
    if (!isInvincible) { setBlinkOn(true); return }
    const t = setInterval(() => setBlinkOn(b => !b), 80)
    return () => clearInterval(t)
  }, [isInvincible])

  // Enhanced 8-bit Sound Generator
  const playSound = (freq, type = 'square', duration = 0.1, rampTo = null) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, ctx.currentTime)
      if (rampTo) osc.frequency.exponentialRampToValueAtTime(rampTo, ctx.currentTime + duration)
      gain.gain.setValueAtTime(0.05, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + duration)
    } catch (e) {}
  }

  const obstacleTimerRef = useRef(0)
  const nextObstacleTargetRef = useRef(80) // Initial delay
  const collectibleTimerRef = useRef(0)
  const gameRef = useRef(null)
  const GRAVITY = 1.2
  const JUMP_FORCE = -22
  const VIEWPORT_HEIGHT = 720
  const GROUND_HEIGHT = 90
  const GROUND_Y = VIEWPORT_HEIGHT - GROUND_HEIGHT

  const CRAB_HEIGHT = 80
  const playerRef = useRef({ x: 600, y: GROUND_Y - CRAB_HEIGHT, vy: 0, width: 60, height: 60, facing: 1, jumps: 0 })
  const keys = useRef({})
  const catcherState = useRef(0)

  // Handle Controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      keys.current[e.code] = true
      if (['Space', 'KeyW', 'ArrowUp'].includes(e.code)) {
        e.preventDefault()
        performJump()
      }
      if (e.code === 'KeyQ' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        e.preventDefault()
        performDash()
      }
    }
    const handleKeyUp = (e) => (keys.current[e.code] = false)
    const handleMouseDown = (e) => {
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
    const timer = setTimeout(() => setShowWarning(false), 3000)
    return () => clearTimeout(timer)
  }, [])

  // Game Loop
  useEffect(() => {
    let animationId

    const update = () => {
      const fixedX = 600
      playerRef.current.x = fixedX
      playerRef.current.facing = 1
      setFacing(1)

      let speedMod = 0
      if (isDashing) speedMod = 15
      if (isStunned) speedMod = -gameSpeed * 0.5
      const worldSpeed = Math.max(1.5, gameSpeed + speedMod)

      if (keys.current['KeyJ'] && !isAttacking) performAttack()

      const isTurbo = keys.current['KeyS']
      playerRef.current.vy += isTurbo ? GRAVITY * 3 : GRAVITY
      playerRef.current.y += playerRef.current.vy

      if (playerRef.current.y > GROUND_Y - CRAB_HEIGHT + 10) {
        playerRef.current.y = GROUND_Y - CRAB_HEIGHT + 10
        playerRef.current.vy = 0
        playerRef.current.jumps = 0
      }

      // Spawn Obstacles
      obstacleTimerRef.current++
      if (obstacleTimerRef.current > nextObstacleTargetRef.current) {
        const groupSize = Math.random() > 0.85 ? 2 : 1 
        const newGroup = []
        let currentX = 1200 + Math.random() * 300 // Randomized starting X
        
        for (let i = 0; i < groupSize; i++) {
          newGroup.push({
            id: Date.now() + Math.random(),
            x: currentX,
            y: GROUND_Y - 75 + (Math.random() * 10 - 5), // Subtle natural height variance
            type: 'RAIZ',
            width: 80,
            height: 80,
            speed: worldSpeed
          })
          currentX += (350 + Math.random() * 250) // Guaranteed gap between group members
        }
        
        setObstacles(prev => [...prev, ...newGroup])
        obstacleTimerRef.current = 0
        
        // Calculate next target with high variance
        const baseRate = Math.max(40, 110 - (score / 12)) // More breathing room
        const variance = Math.random() * 80
        nextObstacleTargetRef.current = baseRate + variance
      }

      // Spawn Collectibles
      collectibleTimerRef.current++
      if (collectibleTimerRef.current > 150) {
        setCollectibles(prev => [...prev, {
          id: Date.now(),
          x: 1200,
          y: GROUND_Y - 60
        }])
        collectibleTimerRef.current = 0
      }

      // Update Obstacles
      setObstacles(prev => {
        const updated = prev.map(o => ({ ...o, x: o.x - worldSpeed }))
          .filter(o => {
            const hitBoxX = playerRef.current.x + 10
            const hitBoxWidth = isAttacking ? 110 : 60
            const obHitX = o.x + 25
            const obHitW = 30
            const obHitY = o.y + 30
            const obHitH = 50
            const isColliding = (
              hitBoxX < obHitX + obHitW &&
              hitBoxX + hitBoxWidth > obHitX &&
              playerRef.current.y + 15 < obHitY + obHitH &&
              playerRef.current.y + 65 > obHitY
            )
            if (isColliding) {
              if (isAttacking) {
                setScore(s => s + 50)
                playSound(150, 'sawtooth', 0.1)
                return false
              } else if (!isInvincible && !isDashing) {
                handleDamage()
                return false
              }
            }
            return o.x > -100
          })
        return updated
      })

      // Update Collectibles
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

      setScore(s => s + (worldSpeed / 10))
      setPlayerPosition({ x: playerRef.current.x, y: playerRef.current.y })

      // Dust Particles (enhanced — only near ground)
      const distFromGround = (GROUND_Y - CRAB_HEIGHT) - playerRef.current.y
      if (distFromGround < 5 && Math.random() > 0.5) {
        setDustParticles(prev => [...prev.slice(-30), {
          id: Date.now() + Math.random(),
          x: playerRef.current.x + Math.random() * 60,
          y: playerRef.current.y + CRAB_HEIGHT - 5,
          size: Math.random() * 8 + 4,
          dx: -(Math.random() * 40 + 20),
          dy: -(Math.random() * 20 + 5),
        }])
      }
      setDustParticles(prev => prev.filter(p => Date.now() - p.id < 500))

      // Chef Chase Logic
      setChefX(prev => {
        const catcherWorldSpeed = gameSpeed - 0.6
        let relativeSpeed = catcherWorldSpeed - worldSpeed
        if (isDashing) relativeSpeed -= 5
        let nextX = prev + relativeSpeed
        const dist = playerRef.current.x - nextX
        catcherState.current = dist > 500 ? 1 : dist < 100 ? 4 : 2
        if (nextX < 50) nextX = 50
        if (nextX >= playerRef.current.x - 40) {
          handleDamage()
          return playerRef.current.x - 400
        }
        return nextX
      })

      setGameSpeed(s => Math.min(s + 0.003, 20))
      animationId = requestAnimationFrame(update)
    }

    animationId = requestAnimationFrame(update)
    return () => cancelAnimationFrame(animationId)
  }, [gameSpeed, onGameOver, setScore, score, isInvincible, lives, facing, isDashing])

  const handleDamage = () => {
    if (isInvincible || isAttacking || isDashing) return
    setLives(prev => {
      const newLives = prev - 1
      if (newLives <= 0) onGameOver()
      return newLives
    })
    setIsInvincible(true)
    setIsStunned(true)
    setTimeout(() => setIsInvincible(false), 1500)
    setTimeout(() => setIsStunned(false), 2000)
    setChefX(prev => Math.min(prev + 100, playerRef.current.x - 80))
  }

  const performJump = () => {
    if (playerRef.current.jumps < 2) {
      playerRef.current.vy = JUMP_FORCE
      playerRef.current.jumps += 1
      playSound(200 + (playerRef.current.jumps * 50), 'square', 0.2, 600)
    }
  }

  const performAttack = () => {
    setIsAttacking(true)
    setTimeout(() => setIsAttacking(false), 300)
  }

  const performDash = () => {
    if (!canDash) return
    if (isStunned) setIsStunned(false)
    setIsDashing(true)
    setCanDash(false)
    playSound(600, 'sine', 0.2, 200)
    setTimeout(() => setIsDashing(false), 200)
    setTimeout(() => setCanDash(true), 1000)
  }

  // Derived values for visual effects
  const distFromGround = (GROUND_Y - CRAB_HEIGHT) - playerRef.current.y
  const isOnGround = distFromGround <= 0
  const shadowScale = Math.max(0.2, 1 - Math.abs(distFromGround) / 280)
  const shadowOpacity = Math.max(0.05, 0.5 * shadowScale)  // Catcher state based on distance for the new hooded spritesheet
  const catcherDist = playerRef.current.x - chefX
  let catcherRow = 3 // Default RUN
  let catcherSteps = 8
  
  if (catcherDist > 350) {
    catcherRow = 2 // WALK
    catcherSteps = 8
  } else if (catcherDist < 100) {
    catcherRow = 4 // ATTACK
    catcherSteps = 6
  }

  // Parallax offsets
  const skyOffset   = (score * -0.3) % 1024
  const treeOffset  = (score * -1.2) % 2048
  const groundOffset = (score * -6) % 80

  return (
    <div className="game-viewport" ref={gameRef}>

      {/* ── SCENARIO ── */}
      <div className="scenario-area">

        {/* Layer 1: Blue Arcade Background */}
        <div
          className="parallax-bg"
          style={{ backgroundPositionX: `${skyOffset}px` }}
        />

        {/* ── HUD ── */}
        <div className="hud">
          <div className="heart-container">
            {[...Array(3)].map((_, i) => (
              <div key={i} className={`heart-life ${i >= lives ? 'lost' : ''}`} />
            ))}
          </div>
          <div className="score-badge">
            {(score / 1000).toFixed(2)} KM
          </div>
        </div>

        {/* ── ABILITY INDICATORS ── */}
        <div className="abilities-container">
          <div className={`dash-indicator ${!canDash ? 'cooldown' : ''}`}>
            <div className="ability-key">Q</div>
            <div className="ability-info">
              <span className="ability-name">DASH</span>
              <span className="ability-status">{canDash ? 'PRONTO' : 'RELOAD'}</span>
            </div>
            {!canDash && <div className="cooldown-bar" style={{ animationDuration: '1s' }} />}
          </div>

          <div className="dash-indicator ability-jump">
            <div className="ability-key">W</div>
            <div className="ability-info">
              <span className="ability-name">PULO 2x</span>
              <span className="ability-status">ATIVO</span>
            </div>
          </div>
        </div>

        {/* ── WARNING ── */}
        {showWarning && score < 10 && (
          <div className="warning-indicator">🚨 FUJA DO CATADOR! 🚨</div>
        )}

        {/* ── CATCHER BOSS (HOODED CHARACTER) ── */}
        <div
          className="chef-boss"
          style={{
            position: 'absolute',
            left: chefX,
            top: GROUND_Y - 156, 
            backgroundImage: 'url("/hooded_spritesheet.png")',
            backgroundSize: '1200px 800px', 
            backgroundPositionY: `-${catcherRow * 160}px`, 
            animation: `catcher-run ${Math.max(0.2, 0.8 - (gameSpeed - 5) * 0.05)}s steps(${catcherSteps}) infinite`,
            zIndex: 15,
            width: '150px',
            height: '160px',
            filter: catcherDist < 200
              ? `drop-shadow(0 0 ${Math.round((200 - catcherDist) / 10)}px rgba(255,60,60,0.8))`
              : 'drop-shadow(0 0 4px rgba(255,60,60,0.3))',
            imageRendering: 'pixelated',
          }}
        />

        {/* ── DUST PARTICLES ── */}
        {dustParticles.map(p => (
          <div
            key={p.id}
            className="dust-particle"
            style={{
              left: p.x,
              top: p.y,
              width: p.size || 8,
              height: p.size || 8,
            }}
          />
        ))}

        {/* ── SHADOW (2.5D) ── */}
        <div style={{
          position: 'absolute',
          left: playerPosition.x + 10,
          top: GROUND_Y - 5,
          width: `${60 * shadowScale}px`,
          height: `${10 * shadowScale}px`,
          marginLeft: `${(60 - 60 * shadowScale) / 2}px`,
          background: `radial-gradient(ellipse, rgba(0,0,0,${shadowOpacity}) 0%, transparent 80%)`,
          borderRadius: '50%',
          zIndex: 8,
          transformOrigin: 'center',
          pointerEvents: 'none',
        }} />

        <div style={{
          position: 'absolute',
          left: playerPosition.x,
          top: playerPosition.y,
          width: '80px',
          height: '80px',
          zIndex: 10,
          opacity: isInvincible ? (blinkOn ? 1 : 0.2) : 1,
          animation: isOnGround
            ? `crab-run-tilt ${Math.max(0.1, 0.4 - (gameSpeed - 5) * 0.03)}s infinite alternate ease-in-out`
            : 'none',
          transform: !isOnGround
            ? 'scaleX(0.88) scaleY(1.1)'
            : isDashing ? 'scaleX(1.15) scaleY(0.85)' : 'none',
        }}>
          <img
            src={isAttacking ? '/uca_crab_attack.png' : '/uca_crab.png'}
            className={`uca-crab ${isAttacking ? 'attacking' : ''} ${isDashing ? 'dashing' : ''} ${isStunned ? 'stunned' : ''}`}
            style={{
              width: '100%',
              height: '100%',
              transform: `scaleX(${facing})`,
              imageRendering: 'pixelated',
            }}
            alt="Uçá"
          />

          {/* Wind Slash Effect */}
          {isAttacking && (
            <div
              className="slash-effect"
              style={{
                top: '-10px',
                left: facing === 1 ? '65px' : '-65px',
                transform: `scaleX(${facing})`,
              }}
            />
          )}
        </div>

        {/* ── OBSTACLES (Roots) ── */}
        {obstacles.map(o => (
          <div key={o.id} style={{
            position: 'absolute',
            left: o.x,
            top: o.y,
            width: o.width,
            height: o.height,
            backgroundImage: 'url("/mangrove_root.png")',
            backgroundSize: 'contain',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            imageRendering: 'pixelated',
            zIndex: 9,
            filter: 'drop-shadow(0 8px 6px rgba(0,0,0,0.5))',
          }} />
        ))}

        {/* ── COLLECTIBLES ── */}
        {collectibles.map(c => (
          <div
            key={c.id}
            style={{
              position: 'absolute',
              left: c.x,
              top: c.y,
              width: '55px',
              height: '55px',
              backgroundImage: 'url("/items_spritesheet.png")',
              backgroundSize: '300% 300%',
              backgroundPosition: '0% 100%',
              backgroundRepeat: 'no-repeat',
              imageRendering: 'pixelated',
              zIndex: 9,
              animation: 'collectible-bob 0.8s infinite ease-in-out',
              filter: 'drop-shadow(0 0 8px rgba(250,204,21,0.8))',
            }}
          />
        ))}

      </div>

      {/* ── GROUND — 2.5D PERSPECTIVE ── */}
      <div
        className="ground-area"
        style={{
          backgroundPositionX: `${groundOffset}px, ${groundOffset}px, 0`,
        }}
      />

    </div>
  )
}

export default Game
