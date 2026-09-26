# Project Rules

You are building a premium digital chronometer portfolio.

## Visual rules

The design must NOT use:

- purple/blue AI gradients
- gradient backgrounds
- generic SaaS UI
- generic bento grids
- excessive glassmorphism
- excessive rounded cards
- random neon effects
- decorative particles
- fake statistics
- unnecessary 3D
- random animations

Primary colors:

#060709
#0A0D14
#10141B
#151A22
#707782
#AEB5BE
#D5D9DE
#00D9FF
#FFB000
#C9A227
#A7FF5A

Do not invent additional colors unless absolutely required.

## Design principle

The website should feel like a precision instrument, not an AI-generated portfolio.

TIME is the primary design language.

Every animation must reinforce:

- time
- precision
- measurement
- mechanics
- synchronization
- execution

If an effect does not support one of these concepts, don't add it.

## Engineering rules

Prefer:

CSS > SVG > Canvas > WebGL

Use Three.js only when it provides a real advantage.

Use GSAP/ScrollTrigger where appropriate.

Avoid unnecessary dependencies.

Optimize for stable 60 FPS.

Respect prefers-reduced-motion.

Never fabricate project metrics or achievements.

Before adding visual effects, inspect the existing composition and ask whether the effect is actually necessary.
