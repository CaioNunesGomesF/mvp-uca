import { useState, useEffect, useRef, useCallback } from 'react'

const Game = ({ onGameOver, score, setScore }) => {
  // ── UI STATE (only these trigger React re-renders) ──
  const [lives, setLives] = useState(3)
  const [isInvincible, setIsInvincible] = useState(false)
  const [isAttacking, setIsAttacking] = useState(false)
  const [isDashing, setIsDashing] = useState(false)
  const [canDash, setCanDash] = useState(true)
  const [canAttack, setCanAttack] = useState(true)
  const [showWarning, setShowWarning] = useState(true)
  const [blinkOn, setBlinkOn] = useState(true)
  const blinkRef = useRef(true)  // Ref mirror to avoid stale closure in game loop
  const audioCtxRef = useRef(null) // Reuse single AudioContext

  // ── DOM REFS (direct manipulation — zero React re-renders) ──
  const gameRef = useRef(null)
  const playerDomRef = useRef(null)   // the player container div
  const shadowDomRef = useRef(null)   // the shadow div
  const chefDomRef = useRef(null)     // the chef div
  const scoreDomRef = useRef(null)    // the score display
  const groundDomRef = useRef(null)   // the ground div
  const skyDomRef = useRef(null)      // the sky/parallax-bg div
  const treeDomRef = useRef(null)     // the trees/parallax-trees div

  // ── PHYSICS / GAME STATE REFS ──
  const playerRef = useRef({ x: 600, y: 0, vy: 0, jumps: 0 })
  const groundYRef = useRef(560) // Default fallback
  const keys = useRef({})
  const mousePos = useRef({ x: 0, y: 0 })
  const obstacleTimerRef = useRef(0)
  const nextObstacleTargetRef = useRef(80)
  const collectibleTimerRef = useRef(0)
  const catcherXRef = useRef(100)
  const obstaclesRef = useRef([])       // obstacles stored in ref, not state
  const collectiblesRef = useRef([])
  const dustRef = useRef([])
  const scoreRef = useRef(0)
  const gameSpeedRef = useRef(6)
  const isStunnedRef = useRef(false)
  const isInvincibleRef = useRef(false)
  const livesRef = useRef(3)
  const currentBiomeRef = useRef('MANGROVE') // 'MANGROVE' or 'CITY'

  // Stable callback refs (never change, so never restart the game loop)
  const handleDamageRef = useRef(null)
  const performAttackRef = useRef(null)

  // ── COMBAT REFS ──
  const isAttackingRef = useRef(false)
  const canAttackRef = useRef(true)
  const isDashingRef = useRef(false)
  const canDashRef = useRef(true)
  const isDownSlappingRef = useRef(false)
  const attackAngleRef = useRef(0)
  const playerScaleRef = useRef({ x: 1, y: 1 })
  const facingRef = useRef(1)

  // ── OBSTACLE DOM NODES (recycled pool approach) ──
  const obstacleDomRefs = useRef({})   // map id -> DOM node
  const collectibleDomRefs = useRef({})
  const dustDomRefs = useRef({})

  // ── CONSTANTS ──
  const GRAVITY = 1.2
  const JUMP_FORCE = -22
  const GROUND_HEIGHT = 160
  const CRAB_HEIGHT = 80

  playerRef.current.y = playerRef.current.y || groundYRef.current - CRAB_HEIGHT

  // ── BLINK for invincibility (ref-driven to not affect game loop) ──
  useEffect(() => {
    if (!isInvincible) { blinkRef.current = true; setBlinkOn(true); return }
    const t = setInterval(() => {
      blinkRef.current = !blinkRef.current
      setBlinkOn(blinkRef.current)
    }, 80)
    return () => clearInterval(t)
  }, [isInvincible])

  // ── SOUND ──
  const playSound = useCallback((freq, type = 'square', duration = 0.1, rampTo = null) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') ctx.resume()
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
  }, [])

  // ── ACTIONS ──
  const performJump = useCallback(() => {
    if (playerRef.current.jumps < 2) {
      playerRef.current.vy = JUMP_FORCE
      playerRef.current.jumps += 1
      playerScaleRef.current = { x: 0.8, y: 1.2 }
      setTimeout(() => { playerScaleRef.current = { x: 1, y: 1 } }, 150)
      playSound(200 + (playerRef.current.jumps * 50), 'square', 0.2, 600)
    }
  }, [playSound])

  const performAttack = useCallback((angle = 0) => {
    if (isAttackingRef.current || !canAttackRef.current) return
    isAttackingRef.current = true
    canAttackRef.current = false
    attackAngleRef.current = angle
    setIsAttacking(true)
    setCanAttack(false)

    const inAir = playerRef.current.y < groundYRef.current - CRAB_HEIGHT
    if (inAir && angle > 45 && angle < 135) {
      isDownSlappingRef.current = true
    }
    playSound(150, 'sawtooth', 0.1, 300)
    setTimeout(() => {
      isAttackingRef.current = false
      isDownSlappingRef.current = false
      setIsAttacking(false)
    }, 500)
    setTimeout(() => {
      canAttackRef.current = true
      setCanAttack(true)
    }, 1000)
  }, [playSound, CRAB_HEIGHT])

  const performDash = useCallback(() => {
    if (!canDashRef.current) return
    isStunnedRef.current = false
    isDashingRef.current = true
    canDashRef.current = false
    setIsDashing(true)
    setCanDash(false)
    playSound(600, 'sine', 0.2, 200)
    setTimeout(() => { isDashingRef.current = false; setIsDashing(false) }, 200)
    setTimeout(() => { canDashRef.current = true; setCanDash(true) }, 1000)
  }, [playSound])

  const handleDamage = useCallback(() => {
    if (isInvincibleRef.current || isDashingRef.current) return
    livesRef.current -= 1
    setLives(livesRef.current)
    if (livesRef.current <= 0) { onGameOver(scoreRef.current); return }
    isInvincibleRef.current = true
    isStunnedRef.current = true
    setIsInvincible(true)
    setTimeout(() => { isInvincibleRef.current = false; setIsInvincible(false) }, 1500)
    setTimeout(() => { isStunnedRef.current = false }, 2000)
    // No more instant teleport! Just a tiny nudge.
    catcherXRef.current += 20
  }, [onGameOver])

  // Keep refs always up-to-date so game loop uses latest version without restarting
  handleDamageRef.current = handleDamage
  performAttackRef.current = performAttack

  // ── CONTROLS ──
  useEffect(() => {
    const handleKeyDown = (e) => {
      keys.current[e.code] = true
      if (['Space', 'KeyW', 'ArrowUp'].includes(e.code)) { e.preventDefault(); performJump() }
      if (['KeyQ', 'ShiftLeft', 'ShiftRight'].includes(e.code)) { e.preventDefault(); performDash() }
    }
    const handleKeyUp = (e) => { keys.current[e.code] = false }
    const handleMouseDown = (e) => {
      if (e.target.tagName === 'BUTTON') return
      const rect = gameRef.current?.getBoundingClientRect()
      if (!rect) return
      const px = rect.left + playerRef.current.x + 40
      const py = rect.top + playerRef.current.y + 40
      const angle = Math.atan2(e.clientY - py, e.clientX - px) * (180 / Math.PI)
      performAttack(angle)
    }
    const handleMouseMove = (e) => { mousePos.current = { x: e.clientX, y: e.clientY } }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [performJump, performAttack, performDash])

  useEffect(() => {
    const updateDimensions = () => {
      if (gameRef.current) {
        const height = gameRef.current.clientHeight
        groundYRef.current = height - GROUND_HEIGHT
        if (playerRef.current.y === 0) {
          playerRef.current.y = groundYRef.current - CRAB_HEIGHT
        }
      }
    }
    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    const timer = setTimeout(() => setShowWarning(false), 3000)
    return () => {
      window.removeEventListener('resize', updateDimensions)
      clearTimeout(timer)
    }
  }, [])

  // ── MAIN GAME LOOP ──
  useEffect(() => {
    let animationId
    let frameCount = 0

    // Reset styles on mount/restart
    currentBiomeRef.current = 'MANGROVE'
    if (skyDomRef.current) {
      skyDomRef.current.style.backgroundImage = "url('/mangrove_bg_new.png')"
      skyDomRef.current.style.backgroundSize = "1024px 200%"
      skyDomRef.current.style.backgroundPositionY = "0%"
      skyDomRef.current.style.filter = "brightness(1.35) contrast(1.1)"
    }
    if (treeDomRef.current) {
      treeDomRef.current.style.display = "block"
    }
    if (groundDomRef.current) {
      groundDomRef.current.style.backgroundImage = `
        linear-gradient(to bottom, #3aff7a 0%, #3aff7a 4px, transparent 4px),
        linear-gradient(to bottom, rgba(255,255,255,0.05) 0%, transparent 40%),
        url('/ground.png')
      `
      groundDomRef.current.style.boxShadow = "0 -5px 25px rgba(58, 255, 122, 0.2)"
    }

    const update = () => {
      frameCount++
      const gs = gameSpeedRef.current
      let speedMod = isDashingRef.current ? 15 : isStunnedRef.current ? -gs * 0.5 : 0
      const worldSpeed = Math.max(1.5, gs + speedMod)

      // Keyboard attack
      if (keys.current['KeyJ'] && !isAttackingRef.current) {
        let angle = 0
        if (keys.current['ArrowUp'] || keys.current['KeyW']) angle = -90
        else if (keys.current['ArrowDown'] || keys.current['KeyS']) angle = 90
        else if (keys.current['ArrowLeft'] || keys.current['KeyA']) angle = 180
        performAttack(angle)
      }

      // Turbo / down slap
      const isTurbo = keys.current['KeyS'] || keys.current['ArrowDown']
      const inAir = playerRef.current.y < groundYRef.current - CRAB_HEIGHT
      if (isTurbo && inAir && !isDownSlappingRef.current) {
        isDownSlappingRef.current = true
        playSound(150, 'triangle', 0.1, 50)
      }

      // Physics
      playerRef.current.vy += isTurbo ? GRAVITY * 3.5 : GRAVITY
      playerRef.current.y += playerRef.current.vy

      const isOnGround = playerRef.current.y >= groundYRef.current - CRAB_HEIGHT - 2
      if (isOnGround) {
        playerRef.current.y = groundYRef.current - CRAB_HEIGHT
        playerRef.current.vy = 0
        playerRef.current.jumps = 0
        if (isDownSlappingRef.current) isDownSlappingRef.current = false
      }

      // ── BIOME TRANSITION (Trigger at 2km) ──
      if (scoreRef.current >= 2000 && currentBiomeRef.current === 'MANGROVE') {
        currentBiomeRef.current = 'CITY'
        if (skyDomRef.current) {
          skyDomRef.current.style.backgroundImage = "url('/calcadao_bg.png')"
          skyDomRef.current.style.backgroundSize = "1024px 200%"
          skyDomRef.current.style.backgroundPositionY = "100%" // Focus on the city panel
          skyDomRef.current.style.filter = "brightness(1.1) contrast(1.1)"
        }
        if (treeDomRef.current) {
          treeDomRef.current.style.display = "none" // City BG has trees already or clean look
        }
        if (groundDomRef.current) {
          groundDomRef.current.style.backgroundImage = `
            linear-gradient(to bottom, #ffffff 0%, #ffffff 3px, transparent 3px),
            linear-gradient(to bottom, rgba(255,255,255,0.05) 0%, transparent 40%),
            url('/city_ground.png')
          `
          groundDomRef.current.style.boxShadow = "0 -5px 25px rgba(255, 255, 255, 0.2)"
        }
      }

      // ── OBSTACLES: mutate in-place to avoid GC pressure ──
      obstacleTimerRef.current++
      if (obstacleTimerRef.current > nextObstacleTargetRef.current) {
        const groupSize = Math.random() > 0.85 ? 2 : 1
        let currentX = 1200 + Math.random() * 300
        for (let i = 0; i < groupSize; i++) {
          obstaclesRef.current.push({
            id: `o${Date.now()}${Math.random()}`,
            x: currentX,
            y: groundYRef.current - 75 + (Math.random() * 10 - 5),
            width: 80, height: 80,
          })
          currentX += 350 + Math.random() * 250
        }
        obstacleTimerRef.current = 0
        const baseRate = Math.max(40, 110 - (scoreRef.current / 12))
        nextObstacleTargetRef.current = baseRate + Math.random() * 80
      }

      const toRemoveObs = []
      for (let i = 0; i < obstaclesRef.current.length; i++) {
        const o = obstaclesRef.current[i]
        o.x -= worldSpeed  // mutate in place — no new object!
        const hitBoxX = playerRef.current.x + 10
        const hitBoxWidth = isAttackingRef.current ? 110 : 60
        const isColliding = (
          hitBoxX < o.x + 55 && hitBoxX + hitBoxWidth > o.x + 25 &&
          playerRef.current.y + 15 < o.y + 80 &&
          playerRef.current.y + (isDownSlappingRef.current ? 90 : 65) > o.y + 30
        )
        let remove = o.x < -100
        if (isColliding) {
          if (isDownSlappingRef.current) {
            playerRef.current.vy = JUMP_FORCE * 0.8
            playerRef.current.jumps = 1
            scoreRef.current += 100
            gameSpeedRef.current = Math.min(gameSpeedRef.current + 0.2, 25)
            playSound(400, 'square', 0.15, 800)
            isDownSlappingRef.current = false
            remove = true
          } else if (!isInvincibleRef.current && !isDashingRef.current) {
            handleDamageRef.current()
            remove = false // Obstáculo continua na tela!
          }
        }
        if (remove) toRemoveObs.push(i)
      }
      for (let i = toRemoveObs.length - 1; i >= 0; i--) {
        obstaclesRef.current.splice(toRemoveObs[i], 1)
      }

      // ── COLLECTIBLES: mutate in-place ──
      collectibleTimerRef.current++
      if (collectibleTimerRef.current > 150) {
        collectiblesRef.current.push({ id: `c${Date.now()}`, x: 1200, y: groundYRef.current - 60 })
        collectibleTimerRef.current = 0
      }
      const toRemoveCol = []
      for (let i = 0; i < collectiblesRef.current.length; i++) {
        const c = collectiblesRef.current[i]
        c.x -= worldSpeed  // mutate in place!
        const collected = (
          playerRef.current.x < c.x + 40 && playerRef.current.x + 70 > c.x &&
          playerRef.current.y < c.y + 40 && playerRef.current.y + 70 > c.y
        )
        if (c.x < -100 || collected) {
          if (collected) { scoreRef.current += 10; playSound(800, 'sine', 0.1) }
          toRemoveCol.push(i)
        }
      }
      for (let i = toRemoveCol.length - 1; i >= 0; i--) {
        collectiblesRef.current.splice(toRemoveCol[i], 1)
      }

      // ── CHEF ──
      const catcherWorldSpeed = gs - 0.6
      let relSpeed = catcherWorldSpeed - worldSpeed
      if (isDashingRef.current) relSpeed -= 5
      
      // Smooth approach if player is stunned (just took damage)
      const stunBoost = isStunnedRef.current ? 3.5 : 0
      
      catcherXRef.current = Math.max(50, catcherXRef.current + relSpeed + stunBoost)
      
      // Don't let chef overlap player's center
      if (catcherXRef.current > playerRef.current.x - 60) {
        catcherXRef.current = playerRef.current.x - 60
      }
      if (catcherXRef.current >= playerRef.current.x - 40) {
        handleDamage()
        catcherXRef.current = playerRef.current.x - 400
      }

      // Score accumulation
      scoreRef.current += worldSpeed / 10
      gameSpeedRef.current = Math.min(gameSpeedRef.current + 0.003, 20)

      // ── DOM UPDATES (direct — no React setState) ──
      const px = playerRef.current.x
      const py = playerRef.current.y
      const zH = (groundYRef.current - CRAB_HEIGHT) - py
      const sf = Math.max(0.5, Math.min(1.0, 1.0 - (Math.abs(zH) / 300)))

      if (playerDomRef.current) {
        const gs2 = gameSpeedRef.current
        const scale = playerScaleRef.current
        const dashScale = isDashingRef.current ? 1.2 : 1
        playerDomRef.current.style.transform = `translate3d(${px}px, ${py}px, 0) scaleX(${scale.x * dashScale}) scaleY(${scale.y})`
        playerDomRef.current.style.opacity = isInvincibleRef.current ? (blinkRef.current ? 1 : 0.2) : 1
        const spriteSub = playerDomRef.current.firstChild
        if (spriteSub) {
          spriteSub.style.transform = `scaleX(${facingRef.current}) ${isDownSlappingRef.current ? 'rotate(180deg)' : ''}`
        }
      }

      if (shadowDomRef.current) {
        shadowDomRef.current.style.transform = `translate3d(${px + 10}px, ${groundYRef.current - 5}px, 0)`
        shadowDomRef.current.style.width = `${60 * sf}px`
        shadowDomRef.current.style.height = `${10 * sf}px`
        shadowDomRef.current.style.opacity = sf * 0.5
      }

      if (chefDomRef.current) {
        chefDomRef.current.style.transform = `translate3d(${catcherXRef.current}px, ${groundYRef.current - 156}px, 0)`
      }

      // Obstacles DOM sync (throttled to every 2 frames)
      if (frameCount % 2 === 0) {
        const obScene = gameRef.current?.querySelector('.scenario-area')
        const obsImg = currentBiomeRef.current === 'CITY' ? '/car_obstacle.png' : '/mangrove_root.png'
        const obsSize = currentBiomeRef.current === 'CITY' ? '85px' : '80px'
        obstaclesRef.current.forEach(o => {
          let el = obstacleDomRefs.current[o.id]
          if (!el && obScene) {
            el = document.createElement('div')
            el.style.cssText = `position:absolute;width:${obsSize};height:${obsSize};background-image:url('${obsImg}');background-size:contain;background-position:center;background-repeat:no-repeat;image-rendering:pixelated;z-index:9;will-change:transform;`
            obScene.appendChild(el)
            obstacleDomRefs.current[o.id] = el
          }
          if (el) el.style.transform = `translate3d(${o.x}px, ${o.y}px, 0)`
        })
        Object.keys(obstacleDomRefs.current).forEach(id => {
          if (!obstaclesRef.current.find(o => o.id === id)) {
            obstacleDomRefs.current[id]?.remove()
            delete obstacleDomRefs.current[id]
          }
        })

        collectiblesRef.current.forEach(c => {
          let el = collectibleDomRefs.current[c.id]
          if (!el && obScene) {
            el = document.createElement('div')
            el.style.cssText = `position:absolute;width:55px;height:55px;background-image:url('/items_spritesheet.png');background-size:300% 300%;background-position:0% 100%;background-repeat:no-repeat;image-rendering:pixelated;z-index:9;animation:collectible-bob 0.8s infinite ease-in-out;will-change:transform;`
            obScene.appendChild(el)
            collectibleDomRefs.current[c.id] = el
          }
          if (el) el.style.transform = `translate3d(${c.x}px, ${c.y}px, 0)`
        })
        Object.keys(collectibleDomRefs.current).forEach(id => {
          if (!collectiblesRef.current.find(c => c.id === id)) {
            collectibleDomRefs.current[id]?.remove()
            delete collectibleDomRefs.current[id]
          }
        })
      }

      // Score UI (throttled to every 6 frames = 10x/sec)
      if (frameCount % 6 === 0 && scoreDomRef.current) {
        scoreDomRef.current.textContent = `${(scoreRef.current / 1000).toFixed(2)} KM`
      }

      // Ground parallax (throttled)
      if (frameCount % 2 === 0) {
        if (groundDomRef.current) {
          const groundOffset = (scoreRef.current * -6) % 200
          groundDomRef.current.style.backgroundPositionX = `0, 0, ${groundOffset}px`
        }
        // SCENERY PARALLAX
        const skyOffset = (scoreRef.current * -0.3) % 1024
        const treeOffset = (scoreRef.current * -1.2) % 1024
        if (skyDomRef.current) skyDomRef.current.style.backgroundPositionX = `${skyOffset}px`
        if (treeDomRef.current) treeDomRef.current.style.backgroundPositionX = `${treeOffset}px`
      }

      animationId = requestAnimationFrame(update)
    }

    animationId = requestAnimationFrame(update)
    return () => {
      cancelAnimationFrame(animationId)
      // Cleanup DOM nodes
      Object.values(obstacleDomRefs.current).forEach(el => el?.remove())
      Object.values(collectibleDomRefs.current).forEach(el => el?.remove())
      obstacleDomRefs.current = {}
      collectibleDomRefs.current = {}
    }
  }, [onGameOver, playSound]) // minimal deps — stable via refs

  return (
    <div className="game-viewport" ref={gameRef}>
      <div className="scenario-area">
        {/* Layer 1: Sky/Stars */}
        <div className="parallax-bg" ref={skyDomRef} />
        {/* Layer 2: Trees */}
        <div className="parallax-trees" ref={treeDomRef} />

        {/* ── HUD ── */}
        <div className="hud">
          <div className="heart-container">
            {[...Array(3)].map((_, i) => (
              <div key={i} className={`heart-life ${i >= lives ? 'lost' : ''}`} />
            ))}
          </div>
          <div className="score-badge" ref={scoreDomRef}>0.00 KM</div>
        </div>

        {/* ── ABILITY INDICATORS ── */}
        <div className="abilities-container">
          <div className={`dash-indicator ability-attack ${!canAttack ? 'cooldown' : ''}`}>
            <div className="ability-key">LMB/J</div>
            <div className="ability-info">
              <span className="ability-name">TAPA</span>
              <span className="ability-status">{canAttack ? 'PRONTO' : 'RELOAD'}</span>
            </div>
            {!canAttack && <div className="cooldown-bar" style={{ animationDuration: '1s' }} />}
          </div>

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

        {showWarning && (
          <div className="warning-indicator">🚨 FUJA DO CATADOR! 🚨</div>
        )}

        {/* ── CHEF BOSS (positioned via direct DOM ref) ── */}
        <div
          ref={chefDomRef}
          className="chef-boss"
          style={{
            position: 'absolute',
            backgroundImage: 'url("/chef_strip.png")',
            backgroundSize: '3360px 100%',
            backgroundRepeat: 'no-repeat',
            animation: `catcher-run 0.7s steps(16) infinite`,
            zIndex: 15,
            width: '210px',
            height: '190px',
            imageRendering: 'pixelated',
            willChange: 'transform',
          }}
        />

        {/* ── SHADOW ── */}
        <div
          ref={shadowDomRef}
          style={{
            position: 'absolute',
            background: 'radial-gradient(ellipse, rgba(0,0,0,0.4) 0%, transparent 80%)',
            borderRadius: '50%',
            zIndex: 8,
            pointerEvents: 'none',
            willChange: 'transform, opacity',
          }}
        />

        {/* ── PLAYER (positioned via direct DOM ref) ── */}
        <div
          ref={playerDomRef}
          style={{
            position: 'absolute',
            width: '80px',
            height: '80px',
            zIndex: 10,
            willChange: 'transform, opacity',
            transformOrigin: 'bottom center',
          }}
        >
          <div
            className={`uca-crab-sprite walking ${isAttacking ? 'attacking' : ''}`}
            style={{ width: '100%', height: '100%' }}
          />

          {isAttacking && (
            <div style={{
              position: 'absolute', left: '40px', top: '40px',
              transform: `rotate(${attackAngleRef.current}deg)`,
              pointerEvents: 'none', zIndex: 25
            }}>
              <div className="slash-effect" style={{ left: '20px', top: '-50px' }} />
            </div>
          )}
        </div>

      </div>

      {/* ── GROUND ── */}
      <div ref={groundDomRef} className="ground-area" />
    </div>
  )
}

export default Game
