import { useState } from 'react'
import { Link } from 'react-router-dom'
import '../App.css'

function Landing() {
  const [activeSlide, setActiveSlide] = useState(1)

  const slides = [
    {
      number: '01',
      label: 'DEFINE',
      title: 'YOUR REQUIREMENTS',
      description:
        'Tell Planora what you want to build. Your requirements become the foundation of the design.',
      meta: ['SPATIAL INPUT', '3 BEDROOMS', '2 BATHROOMS', '1200 SQ.FT.'],
      visual: 'requirements',
      image: '/define.png', // Removed public prefix as Vite serves public folder at root
    },
    {
      number: '02',
      label: 'GENERATE',
      title: 'AI FLOOR PLAN',
      description:
        'Planora transforms your requirements into intelligent architectural layouts in seconds.',
      meta: ['AI GENERATED', 'PLAN / 004', '98.4% MATCH', 'CONSTRAINT READY'],
      visual: 'floorplan',
      image: '/floorplan.png',
    },
    {
      number: '03',
      label: 'TRANSFORM',
      title: '2D → 3D SPACE',
      description:
        'Turn your selected floor plan into a spatial 3D model and see how your design comes together.',
      meta: ['SPATIAL MODEL', 'REAL-TIME', 'WALL HEIGHT 3.0M', 'LIVE VIEW'],
      visual: 'threeD',
      image: '/exterior.png',
    },
    {
      number: '04',
      label: 'EXPLORE',
      title: 'STEP INSIDE',
      description:
        'Explore your future space in 3D and understand the relationship between every room.',
      meta: ['IMMERSIVE VIEW', '01 FLOOR', '08 ROOMS', 'LIVE MODEL'],
      visual: 'interior',
      image: '/interior.png',
    },
  ]

  const nextSlide = () => {
    setActiveSlide((prev) => (prev + 1) % slides.length)
  }

  const previousSlide = () => {
    setActiveSlide(
      (prev) => (prev - 1 + slides.length) % slides.length
    )
  }

  return (
    <div className="planora">

      {/* NAVIGATION */}
      <header className="navbar">
        <div className="logo">
          PLANORA<span>+</span>
        </div>

        <nav>
          <a href="#home">Home</a>
          <a href="#about">About</a>
          <a href="#process">How It Works</a>
          <a href="#technology">Technology</a>
        </nav>

        <div className="nav-actions">
          <Link to="/login" className="login-btn">
            Login
          </Link>

          <Link to="/register" className="start-btn">
            Get Started <span>↗</span>
          </Link>
        </div>
      </header>


      {/* HERO */}
      <main id="home" className="hero">

        <div className="stars" />
        <div className="ambient-glow glow-one" />
        <div className="ambient-glow glow-two" />

        <div className="coordinate coordinate-one">
          <span>40.7128° N</span>
          <span>74.0060° W</span>
        </div>

        <div className="coordinate coordinate-two">
          <span>SPATIAL AI</span>
          <span>v1.0</span>
        </div>


        {/* MAIN TEXT */}
        <section className="hero-content">

          <div className="hero-tag">
            <span className="tag-dot" />
            AI POWERED ARCHITECTURAL DESIGN
          </div>

          <h1>
            DESIGN YOUR
            <br />
            <span>SPACE.</span>
          </h1>

          <p>
            Transform your ideas into intelligent floor plans,
            refine your design, and step inside your future
            space in 3D.
          </p>

          <div className="hero-actions">

            <Link to="/register" className="primary-button">
              START DESIGNING
              <span>↗</span>
            </Link>

            <a href="#process" className="secondary-button">
              EXPLORE PLANORA
              <span>↓</span>
            </a>

          </div>

        </section>


        {/* ARCHITECTURAL VISUAL */}
        <section className="architecture">

          <div className="architecture-halo" />

          <div className="house">

            <div className="house-floor floor-one" />
            <div className="house-floor floor-two" />
            <div className="house-floor floor-three" />

            <div className="house-wall wall-left" />
            <div className="house-wall wall-right" />
            <div className="house-wall wall-back" />

            <div className="window window-one" />
            <div className="window window-two" />
            <div className="window window-three" />

          </div>


          <div className="architecture-label label-one">
            <span>01</span>
            <strong>GENERATE</strong>
            <small>AI FLOOR PLAN</small>
          </div>

          <div className="architecture-label label-two">
            <span>02</span>
            <strong>TRANSFORM</strong>
            <small>2D → 3D</small>
          </div>

          <div className="architecture-label label-three">
            <span>03</span>
            <strong>EXPLORE</strong>
            <small>YOUR SPACE</small>
          </div>

        </section>


        {/* BOTTOM INFO */}
        <div className="hero-bottom">

          <div>
            <span>PLANORA / 001</span>
            <span>SPATIAL INTELLIGENCE</span>
          </div>

          <div className="scroll">
            SCROLL TO EXPLORE
            <span>↓</span>
          </div>

          <div>
            <span>2D PLAN</span>
            <span>→</span>
            <span>3D SPACE</span>
          </div>

        </div>

      </main>


      {/* ==================================================
          ARCHITECTURAL SHOWCASE
      ================================================== */}

      <section className="showcase-section" id="process">

        {/* TOP LABEL */}
        <div className="showcase-header">

          <div className="showcase-index">
            <span>02</span>
            <small>PLANORA / PROCESS</small>
          </div>

          <div className="showcase-heading">
            <span>EXPLORE WHAT YOU CAN CREATE</span>

            <h2>
              FROM IDEA
              <br />
              <em>TO SPACE.</em>
            </h2>
          </div>

          <p>
            Follow the journey from your first requirements
            to an intelligent architectural space.
          </p>

        </div>


        {/* SLIDER */}
        <div className="showcase-slider">

          <button
            className="showcase-arrow showcase-prev"
            onClick={previousSlide}
            aria-label="Previous slide"
          >
            ←
          </button>


          <div className="showcase-track">

            {slides.map((slide, index) => {

              const isActive = index === activeSlide

              return (
                <article
                  key={slide.number}
                  className={`showcase-card ${
                    isActive ? 'active' : ''
                  }`}
                  onClick={() => setActiveSlide(index)}
                >

                  {/* REAL ARCHITECTURAL IMAGE */}
                  <div className={`showcase-visual ${slide.visual}`}>

                    <img
                      src={slide.image}
                      alt={slide.title}
                      className="showcase-image"
                    />

                    <div className="showcase-image-shade" />

                    <div className="visual-corner visual-top">
                      PLANORA / {slide.number}
                    </div>

                    <div className="visual-corner visual-bottom">
                      SPATIAL DESIGN
                    </div>

                  </div>


                  {/* CARD CONTENT */}
                  <div className="showcase-card-content">

                    <div className="card-number">
                      {slide.number}
                    </div>

                    <div className="card-main">

                      <span className="card-label">
                        {slide.label}
                      </span>

                      <h3>
                        {slide.title}
                      </h3>

                      {isActive && (
                        <p>
                          {slide.description}
                        </p>
                      )}

                    </div>

                    <div className="card-arrow">
                      ↗
                    </div>

                  </div>


                  {/* METADATA */}
                  {isActive && (
                    <div className="card-meta">

                      {slide.meta.map((item) => (
                        <span key={item}>
                          {item}
                        </span>
                      ))}

                    </div>
                  )}

                </article>
              )
            })}

          </div>


          <button
            className="showcase-arrow showcase-next"
            onClick={nextSlide}
            aria-label="Next slide"
          >
            →
          </button>

        </div>


        {/* SLIDER FOOTER */}
        <div className="showcase-footer">

          <div className="progress-line">

            {slides.map((slide, index) => (
              <button
                key={slide.number}
                className={
                  index === activeSlide ? 'progress-active' : ''
                }
                onClick={() => setActiveSlide(index)}
              >
                <span>{slide.number}</span>
              </button>
            ))}

          </div>

          <span className="showcase-count">
            0{activeSlide + 1} / 04
          </span>

          <span className="showcase-hint">
            DRAG / CLICK TO EXPLORE
          </span>

        </div>

      </section>
      
    </div>
  )
}

export default Landing
