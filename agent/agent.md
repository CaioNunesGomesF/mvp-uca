# Agente: Caranguejo (A Rebelião da Carapaça)

## Descrição Geral
O agente principal é um caranguejo biológico. A movimentação ocorre em uma pista de corrida infinita com perspectiva 2.5D (falso 2D). A colisão física permanece no plano bidimensional inferior, enquanto o sprite manipula o eixo Y local e a escala da sombra para simular profundidade (eixo Z) durante saltos e esquivas.

## Estrutura de Nós (Godot)
- `CharacterBody2D` (Nó Raiz do Player)
  - `CollisionShape2D` (Hitbox fixada na base)
  - `Sprite2D` (`CrabSprite` - Visual do caranguejo)
  - `Sprite2D` (`Shadow` - Sombra dinâmica projetada no chão)

## Implementação Lógica (GDScript)

```gdscript
extends CharacterBody2D

@export var speed: float = 450.0
@export var jump_force: float = -600.0
@export var gravity: float = 1500.0

var z_height: float = 0.0
var z_velocity: float = 0.0
var is_jumping: bool = false

@onready var sprite = $CrabSprite
@onready var shadow = $Shadow

func _physics_process(delta: float) -> void:
    var input_dir = Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
    velocity = input_dir * speed

    if Input.is_action_just_pressed("ui_accept") and not is_jumping:
        z_velocity = jump_force
        is_jumping = true
        apply_squash_and_stretch(0.8, 1.2) 

    if is_jumping:
        z_velocity += gravity * delta
        z_height += z_velocity * delta
        
        if z_height >= 0:
            z_height = 0
            is_jumping = false
            apply_squash_and_stretch(1.3, 0.7) 

    sprite.position.y = z_height
    update_shadow()
    
    move_and_slide()

func update_shadow() -> void:
    if shadow:
        var scale_factor = clamp(1.0 - (abs(z_height) / 300.0), 0.5, 1.0)
        shadow.scale = Vector2(scale_factor, scale_factor)
        shadow.modulate.a = scale_factor

func apply_squash_and_stretch(x_scale: float, y_scale: float) -> void:
    var tween = create_tween()
    tween.tween_property(sprite, "scale", Vector2(x_scale, y_scale), 0.1)
    tween.chain().tween_property(sprite, "scale", Vector2(1.0, 1.0), 0.1)