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

  // ── BACKGROUND TREES (decorative parallax elements) ──
  const bgTreesRef = useRef([])        // [{id, x, layer:'far'|'mid'}]
  const bgTreeDomRefs = useRef({})     // map id -> DOM node
  const bgTreeTimerRef = useRef(0)

  // ── CONSTANTS ──
  const GRAVITY = 1.2
  const JUMP_FORCE = -22
  const GROUND_HEIGHT = 130
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
      if (['KeyS', 'ArrowDown'].includes(e.code)) {
        // If in air, perform a down slap (angle 90). Otherwise just crouch/do nothing.
        const inAir = playerRef.current.y < groundYRef.current - CRAB_HEIGHT
        if (inAir) {
          e.preventDefault()
          performAttack(90)
        }
      }
      if (['KeyJ', 'KeyF'].includes(e.code)) {
        e.preventDefault()
        performAttack(0)
      }
    }
    const handleKeyUp = (e) => { keys.current[e.code] = false }
    const handleMouseDown = (e) => {
      if (e.target.closest('.btn-mobile')) return
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
    // Sky and ground are now pure CSS — no JS overrides needed on init
    if (treeDomRef.current) {
      treeDomRef.current.style.display = "none"
      treeDomRef.current.style.backgroundImage = ""
      treeDomRef.current.style.backgroundSize = ""
      treeDomRef.current.style.backgroundPositionY = ""
      treeDomRef.current.style.filter = ""
    }
    // Reset ground to pixel art style
    if (groundDomRef.current) {
      groundDomRef.current.style.backgroundColor = 'transparent'
      groundDomRef.current.style.backgroundImage = ''
      groundDomRef.current.style.backgroundRepeat = ''
      groundDomRef.current.style.backgroundSize = ''
      groundDomRef.current.style.backgroundPositionY = ''
      groundDomRef.current.style.borderTop = 'none'
      groundDomRef.current.style.boxShadow = 'none'
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



      // ── OBSTACLES: mutate in-place to avoid GC pressure ──
      obstacleTimerRef.current++
      if (obstacleTimerRef.current > nextObstacleTargetRef.current) {
        const isCombo = Math.random() > 0.85 // 15% chance to spawn a Rebound Combo!
        const viewportW = gameRef.current ? gameRef.current.clientWidth : 1200
        
        if (isCombo) {
          let currentX = viewportW + 50 + Math.random() * 150
          // 1. Spawns a small log (springboard)
          obstaclesRef.current.push({
            id: `o_spring_${Date.now()}`,
            x: currentX,
            y: groundYRef.current - 42,
            type: 'log',
            width: 80,
            height: 42,
          })
          
          // 2. Spawns a colossal megalog slightly ahead (the wall)
          obstaclesRef.current.push({
            id: `o_wall_${Date.now()}`,
            x: currentX + 220, // Perfectly spaced for the rebound timing!
            y: groundYRef.current - 175,
            type: 'megalog', // Giant Colossal Trunk
            width: 70,
            height: 175,
          })
        } else {
          // Normal spawning
          const groupSize = Math.random() > 0.85 ? 2 : 1
          let currentX = viewportW + Math.random() * 200
          for (let i = 0; i < groupSize; i++) {
            const types = ['root', 'barrel', 'rock', 'log', 'biglog', 'biglog_horiz']
            const randomType = types[Math.floor(Math.random() * types.length)]
            
            let w = 80, h = 80
            if (randomType === 'barrel') { w = 60; h = 70 }
            else if (randomType === 'log') { w = 80; h = 42 }
            else if (randomType === 'rock') { w = 70; h = 55 }
            else if (randomType === 'biglog') { w = 65; h = 130 }
            else if (randomType === 'biglog_horiz') { w = 150; h = 50 }
            
            obstaclesRef.current.push({
              id: `o${Date.now()}${Math.random()}`,
              x: currentX,
              y: groundYRef.current - h, // Base perfectly sits on the ground!
              type: randomType,
              width: w,
              height: h,
            })
            currentX += w + 120 + Math.random() * 100 // space out grouped obstacles
          }
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
          hitBoxX < o.x + o.width - 10 && hitBoxX + hitBoxWidth > o.x + 10 &&
          playerRef.current.y + 15 < o.y + o.height &&
          playerRef.current.y + (isDownSlappingRef.current ? 90 : 65) > o.y + 10
        )
        let remove = o.x < -100
        if (isColliding) {
          if (isDownSlappingRef.current) {
            playerRef.current.vy = JUMP_FORCE * 0.95 // Stronger bounce off the big elements!
            playerRef.current.jumps = 1
            scoreRef.current += 150 // More points for breaking/bouncing off a big obstacle!
            gameSpeedRef.current = Math.min(gameSpeedRef.current + 0.3, 25)
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
        const viewportW = gameRef.current ? gameRef.current.clientWidth : 1200
        collectiblesRef.current.push({ id: `c${Date.now()}`, x: viewportW, y: groundYRef.current - 60 })
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
        obstaclesRef.current.forEach(o => {
          let el = obstacleDomRefs.current[o.id]
          if (!el && obScene) {
            el = document.createElement('div')
            
            if (o.type === 'root') {
              el.style.cssText = `position:absolute;width:80px;height:80px;background-image:url('/mangrove_root.png');background-size:contain;background-position:center;background-repeat:no-repeat;image-rendering:pixelated;z-index:9;will-change:transform;`
            } else if (o.type === 'barrel') {
              // Beautiful pixel-art style Barrel built dynamically with CSS
              el.style.cssText = `
                position:absolute;width:60px;height:70px;
                background: #8b5a2b;
                background-image: 
                  linear-gradient(90deg, rgba(0,0,0,0.2) 20%, transparent 20%, transparent 40%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.2) 60%, transparent 60%, transparent 80%, rgba(0,0,0,0.2) 80%),
                  linear-gradient(to bottom, #5c3a21 0%, #8b5a2b 20%, #8b5a2b 80%, #5c3a21 100%);
                border-radius: 12px / 20px;
                border: 4px solid #3d2516;
                box-shadow: inset 0 0 10px rgba(0,0,0,0.6);
                z-index:9;
                will-change:transform;
              `
              // Add iron bands top and bottom
              const band1 = document.createElement('div')
              band1.style.cssText = `position:absolute; left:0; top:12px; width:100%; height:6px; background:#4a4a4a; border-top:2px solid #7a7a7a; border-bottom:2px solid #2a2a2a;`
              const band2 = document.createElement('div')
              band2.style.cssText = `position:absolute; left:0; bottom:12px; width:100%; height:6px; background:#4a4a4a; border-top:2px solid #7a7a7a; border-bottom:2px solid #2a2a2a;`
              el.appendChild(band1)
              el.appendChild(band2)
            } else if (o.type === 'log') {
              // Beautiful fallen Log built dynamically with CSS
              el.style.cssText = `
                position:absolute;width:80px;height:42px;
                background: #5c3a21;
                border: 4px solid #2d1b0f;
                border-radius: 6px;
                background-image: linear-gradient(to bottom, rgba(255,255,255,0.05) 50%, rgba(0,0,0,0.15) 50%);
                z-index:9;
                will-change:transform;
              `
              // Log ends showing inner wood rings
              const endL = document.createElement('div')
              endL.style.cssText = `position:absolute; top:0; left:-6px; width:12px; height:100%; background:#d2b48c; border:4px solid #2d1b0f; border-radius:50%;`
              const endR = document.createElement('div')
              endR.style.cssText = `position:absolute; top:0; right:-6px; width:12px; height:100%; background:#d2b48c; border:4px solid #2d1b0f; border-radius:50%;`
              el.appendChild(endL)
              el.appendChild(endR)
            } else if (o.type === 'biglog') {
              // Tall Vertical Trunk/Log built dynamically with CSS
              el.style.cssText = `
                position:absolute;width:65px;height:130px;
                background: #5c3a21;
                border: 4px solid #2d1b0f;
                border-radius: 12px 12px 6px 6px;
                background-image: 
                  linear-gradient(90deg, rgba(0,0,0,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.05) 75%, rgba(0,0,0,0.15) 75%),
                  linear-gradient(to bottom, #422817 0%, #5c3a21 15%, #5c3a21 90%, #2d1b0f 100%);
                box-shadow: inset 0 0 10px rgba(0,0,0,0.5);
                z-index:9;
                will-change:transform;
              `
              // Wood ring top
              const ringTop = document.createElement('div')
              ringTop.style.cssText = `position:absolute; top:-4px; left:4px; width:49px; height:10px; background:#d2b48c; border:4px solid #2d1b0f; border-radius:50%;`
              
              // Leaves sprouting out from trunk
              const leaf1 = document.createElement('div')
              leaf1.style.cssText = `position:absolute; top:30px; left:-14px; width:22px; height:16px; background:#22c55e; border:3px solid #166534; border-radius:12px 0 12px 0; transform:rotate(-20deg);`
              const leaf2 = document.createElement('div')
              leaf2.style.cssText = `position:absolute; top:65px; right:-14px; width:22px; height:16px; background:#16a34a; border:3px solid #14532d; border-radius:0 12px 0 12px; transform:rotate(15deg);`
              
              el.appendChild(ringTop)
              el.appendChild(leaf1)
              el.appendChild(leaf2)
            } else if (o.type === 'biglog_horiz') {
              // Giant Horizontal Log built dynamically with CSS
              el.style.cssText = `
                position:absolute;width:150px;height:50px;
                background: #5c3a21;
                border: 4px solid #2d1b0f;
                border-radius: 6px;
                background-image: 
                  linear-gradient(to bottom, rgba(255,255,255,0.08) 30%, transparent 30%, transparent 70%, rgba(0,0,0,0.2) 70%),
                  linear-gradient(90deg, rgba(0,0,0,0.1) 10%, transparent 10%, transparent 90%, rgba(0,0,0,0.1) 90%);
                box-shadow: inset 0 0 12px rgba(0,0,0,0.5);
                z-index:9;
                will-change:transform;
              `
              // Log ends showing inner wood rings
              const endL = document.createElement('div')
              endL.style.cssText = `position:absolute; top:0; left:-6px; width:12px; height:100%; background:#d2b48c; border:4px solid #2d1b0f; border-radius:50%;`
              const endR = document.createElement('div')
              endR.style.cssText = `position:absolute; top:0; right:-6px; width:12px; height:100%; background:#d2b48c; border:4px solid #2d1b0f; border-radius:50%;`
              
              // Leaves sprouting out from top
              const leaf1 = document.createElement('div')
              leaf1.style.cssText = `position:absolute; top:-10px; left:40px; width:22px; height:16px; background:#22c55e; border:3px solid #166534; border-radius:12px 0 12px 0; transform:rotate(-10deg);`
              const leaf2 = document.createElement('div')
              leaf2.style.cssText = `position:absolute; top:-12px; left:90px; width:25px; height:18px; background:#16a34a; border:3px solid #14532d; border-radius:0 12px 0 12px; transform:rotate(20deg);`
              
              el.appendChild(endL)
              el.appendChild(endR)
              el.appendChild(leaf1)
              el.appendChild(leaf2)
            } else if (o.type === 'megalog') {
              // Megalog - Giant Colossal Redwood-like Trunk built dynamically with CSS
              el.style.cssText = `
                position:absolute;width:70px;height:175px;
                background: #3e271a;
                border: 5px solid #1c100a;
                border-radius: 16px 16px 4px 4px;
                background-image: 
                  linear-gradient(90deg, rgba(0,0,0,0.3) 15%, transparent 15%, transparent 85%, rgba(0,0,0,0.3) 85%),
                  linear-gradient(to bottom, #2b1a11 0%, #3e271a 10%, #3e271a 90%, #1c100a 100%);
                box-shadow: inset 0 0 15px rgba(0,0,0,0.7);
                z-index:9;
                will-change:transform;
              `
              // Giant wood ring top
              const ringTop = document.createElement('div')
              ringTop.style.cssText = `position:absolute; top:-5px; left:4px; width:52px; height:10px; background:#c1a076; border:4px solid #1c100a; border-radius:50%;`
              
              // Vines/Leaves hanging down
              const vine = document.createElement('div')
              vine.style.cssText = `position:absolute; top:25px; left:12px; width:4px; height:80px; background:#15803d; border-radius:2px; opacity:0.8;`
              const leaf1 = document.createElement('div')
              leaf1.style.cssText = `position:absolute; top:35px; left:2px; width:16px; height:12px; background:#22c55e; border-radius:50%; transform:rotate(-45deg);`
              const leaf2 = document.createElement('div')
              leaf2.style.cssText = `position:absolute; top:65px; left:8px; width:16px; height:12px; background:#16a34a; border-radius:50%; transform:rotate(45deg);`
              
              el.appendChild(ringTop)
              el.appendChild(vine)
              el.appendChild(leaf1)
              el.appendChild(leaf2)
            } else {
              // Natural Mossy Rock built dynamically with CSS
              el.style.cssText = `
                position:absolute;width:70px;height:55px;
                background: #4a5357;
                background-image: radial-gradient(circle at 30% 30%, #5e6b70 20%, transparent 60%);
                border: 4px solid #212527;
                border-radius: 40% 50% 35% 30%;
                z-index:9;
                will-change:transform;
              `
              // Moss patches
              const moss = document.createElement('div')
              moss.style.cssText = `position:absolute; top:4px; left:12px; width:35px; height:12px; background:#4d7c0f; border-radius:50%; filter: blur(0.5px);`
              el.appendChild(moss)
            }

            obScene.appendChild(el)
            obstacleDomRefs.current[o.id] = el
          }
          if (el) {
            // Since y is already perfectly grounded at spawn (y = groundY - h),
            // we do NOT add any vertical offsets here. This stops obstacles from clipping!
            el.style.transform = `translate3d(${o.x}px, ${o.y}px, 0)`
          }
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

      // ── BACKGROUND TREES (decorative parallax, 2 layers) ──
      bgTreeTimerRef.current++

      // Spawn a new tree every ~80 frames (staggered)
      if (bgTreeTimerRef.current > 80 + Math.random() * 60) {
        bgTreeTimerRef.current = 0
        const layer = Math.random() > 0.45 ? 'far' : 'mid'
        // Store the Y offset once at spawn to avoid per-frame jitter
        const yOff = layer === 'far' ? 160 + Math.random() * 30 : 110 + Math.random() * 20
        bgTreesRef.current.push({ id: `bt${Date.now()}${Math.random()}`, x: 1300, layer, yOff })
      }

      // Scroll + sync each tree DOM element
      if (frameCount % 2 === 0) {
        const obScene = gameRef.current?.querySelector('.scenario-area')
        bgTreesRef.current.forEach(t => {
          // Speed: far = 30% of worldSpeed, mid = 55%
          const speed = t.layer === 'far' ? 0.30 : 0.55
          t.x -= gameSpeedRef.current * speed

          let el = bgTreeDomRefs.current[t.id]
          if (!el && obScene) {
            el = document.createElement('div')
            const isFar = t.layer === 'far'
            // Visual differences per layer
            const trunkH = isFar ? 80 + Math.random() * 50 : 50 + Math.random() * 30
            const trunkW = isFar ? 10 + Math.random() * 6 : 7 + Math.random() * 5
            const canopyW = isFar ? 60 + Math.random() * 40 : 40 + Math.random() * 25
            const canopyH = isFar ? 80 + Math.random() * 40 : 55 + Math.random() * 25
            // Darker/bluer for far layer, greener for mid
            const trunkColor = isFar ? '#3d2810' : '#5a3a18'
            const canopyColor = isFar
              ? `hsl(${130 + Math.random() * 20}, ${40 + Math.random() * 15}%, ${18 + Math.random() * 8}%)`
              : `hsl(${125 + Math.random() * 25}, ${55 + Math.random() * 20}%, ${25 + Math.random() * 10}%)`
            const totalH = trunkH + canopyH
            const bottomOffset = 130 // ground height
            const yPos = groundYRef.current - totalH + 5 // sit on ground
            const opacity = isFar ? 0.55 + Math.random() * 0.2 : 0.75 + Math.random() * 0.2
            const zIndex = isFar ? 2 : 4 // far behind sky layers, mid in front of bg

            // Build the tree: canopy blob on top of trunk
            el.style.cssText = `
              position:absolute;
              left:0; top:0;
              width:${Math.max(canopyW, trunkW)}px;
              height:${totalH}px;
              opacity:${opacity};
              pointer-events:none;
              z-index:${zIndex};
              will-change:transform;
            `
            // Trunk
            const trunk = document.createElement('div')
            trunk.style.cssText = `
              position:absolute;
              bottom:0;
              left:50%;
              transform:translateX(-50%);
              width:${trunkW}px;
              height:${trunkH}px;
              background:${trunkColor};
              border-radius:${trunkW / 2}px ${trunkW / 2}px 0 0;
            `
            // Canopy (one big blob + two side ones for mangrove feel)
            const canopy = document.createElement('div')
            canopy.style.cssText = `
              position:absolute;
              bottom:${trunkH - 10}px;
              left:50%;
              transform:translateX(-50%);
              width:${canopyW}px;
              height:${canopyH}px;
              background:${canopyColor};
              border-radius:50% 50% 40% 40%;
              box-shadow: ${-canopyW * 0.3}px ${canopyH * 0.2}px 0 ${canopyColor},
                          ${canopyW * 0.3}px ${canopyH * 0.15}px 0 ${canopyColor};
            `
            el.appendChild(trunk)
            el.appendChild(canopy)
            obScene.appendChild(el)
            bgTreeDomRefs.current[t.id] = el
          }
          if (el) {
            el.style.transform = `translate3d(${t.x}px, ${groundYRef.current - t.yOff}px, 0)`
          }
        })

        // Remove trees that went off-screen left
        bgTreesRef.current = bgTreesRef.current.filter(t => {
          if (t.x < -200) {
            bgTreeDomRefs.current[t.id]?.remove()
            delete bgTreeDomRefs.current[t.id]
            return false
          }
          return true
        })
      }

      // Ground parallax — scroll the real texture
      if (frameCount % 2 === 0) {
        if (groundDomRef.current) {
          const groundOffset = (scoreRef.current * -4) % 800
          groundDomRef.current.style.backgroundPositionX = `${groundOffset}px`
        }
        // TREE PARALLAX (sky is now CSS gradient, no X offset needed)
        const treeOffset = (scoreRef.current * -1.2) % 1024
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
      Object.values(bgTreeDomRefs.current).forEach(el => el?.remove())
      obstacleDomRefs.current = {}
      collectibleDomRefs.current = {}
      bgTreeDomRefs.current = {}
      bgTreesRef.current = []
      bgTreeTimerRef.current = 0
    }
  }, [onGameOver, playSound]) // minimal deps — stable via refs

  return (
    <div className="game-viewport" ref={gameRef}>
      <div className="scenario-area">
        {/* Layer 1: Sky gradient */}
        <div className="parallax-bg" ref={skyDomRef} />

        {/* Layer 2: Clouds (pure CSS animation) */}
        <div className="sky-cloud c1"><div className="cloud-body" /></div>
        <div className="sky-cloud c2"><div className="cloud-body" /></div>
        <div className="sky-cloud c3"><div className="cloud-body" /></div>
        <div className="sky-cloud c4"><div className="cloud-body" /></div>
        <div className="sky-cloud c5"><div className="cloud-body" /></div>

        {/* Layer 3: Birds (pure CSS animation) */}
        <div className="sky-bird b1"><div className="bird-wing"><div className="wing-l" /><div className="wing-r" /></div></div>
        <div className="sky-bird b2"><div className="bird-wing"><div className="wing-l" /><div className="wing-r" /></div></div>
        <div className="sky-bird b3"><div className="bird-wing"><div className="wing-l" /><div className="wing-r" /></div></div>
        <div className="sky-bird b4"><div className="bird-wing"><div className="wing-l" /><div className="wing-r" /></div></div>
        <div className="sky-bird b5"><div className="bird-wing"><div className="wing-l" /><div className="wing-r" /></div></div>
        {/* Mini flock */}
        <div className="sky-bird f1"><div className="bird-wing"><div className="wing-l" /><div className="wing-r" /></div></div>
        <div className="sky-bird f2"><div className="bird-wing"><div className="wing-l" /><div className="wing-r" /></div></div>
        <div className="sky-bird f3"><div className="bird-wing"><div className="wing-l" /><div className="wing-r" /></div></div>

        {/* Layer 4: Trees */}
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

        {/* ── VIRTUAL GAMEPAD HUD (MOBILE ONLY) ── */}
        <div className="mobile-controls">
          <div className="mobile-left-pad">
            <div 
              className="btn-mobile btn-mobile-dash" 
              onPointerDown={() => performDash()}
            >
              <span className="btn-icon">⚡</span>
              <span>DASH</span>
            </div>
            <div 
              className="btn-mobile btn-mobile-down" 
              onPointerDown={() => performAttack(90)}
            >
              <span className="btn-icon">👇</span>
              <span>TAPA BAIXO</span>
            </div>
          </div>
          <div className="mobile-right-pad">
            <div 
              className="btn-mobile btn-mobile-jump" 
              onPointerDown={() => performJump()}
            >
              <span className="btn-icon">⇧</span>
              <span>PULO</span>
            </div>
          </div>
        </div>

      </div>

      {/* ── GROUND ── */}
      <div ref={groundDomRef} className="ground-area" />
    </div>
  )
}

export default Game
