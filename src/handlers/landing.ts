// Landing Page Handler - Inspired by workers.cloudflare.com
// Modern, minimal design with dark theme

export function renderLandingPage(): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>InboxBuddy - AI Scheduling Assistant</title>
  <meta name="description" content="Just CC meetme@ in any email. Your AI schedules the meeting.">
  
  <!-- Open Graph / Social Sharing -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://inboxbuddy.dev/">
  <meta property="og:title" content="InboxBuddy - AI Scheduling Assistant">
  <meta property="og:description" content="Just CC meetme@ in any email thread. Your AI assistant checks calendars, proposes times, and books the meeting. No more back-and-forth.">
  <meta property="og:image" content="https://inboxbuddy.dev/og-image.png">
  <meta property="og:image:width" content="1380">
  <meta property="og:image:height" content="622">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@whoiskatrin">
  <meta name="twitter:creator" content="@whoiskatrin">
  <meta name="twitter:title" content="InboxBuddy - AI Scheduling Assistant">
  <meta name="twitter:description" content="Just CC meetme@ in any email thread. Your AI assistant checks calendars, proposes times, and books the meeting.">
  <meta name="twitter:image" content="https://inboxbuddy.dev/og-image.png">
  <meta name="twitter:image:alt" content="InboxBuddy - AI Scheduling Assistant">
  
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23f97316' stroke-width='2'><rect x='3' y='4' width='18' height='18' rx='2'/><line x1='16' y1='2' x2='16' y2='6'/><line x1='8' y1='2' x2='8' y2='6'/><line x1='3' y1='10' x2='21' y2='10'/></svg>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-primary: #0a0a0a;
      --bg-secondary: #111111;
      --bg-tertiary: #1a1a1a;
      --bg-card: #141414;
      --border: #262626;
      --border-hover: #404040;
      --text-primary: #fafafa;
      --text-secondary: #a1a1aa;
      --text-tertiary: #71717a;
      --accent: #f97316;
      --accent-hover: #ea580c;
      --accent-subtle: rgba(249, 115, 22, 0.1);
      --green: #22c55e;
      --blue: #3b82f6;
      --purple: #a855f7;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      overflow-x: hidden;
    }

    /* Navigation */
    nav {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 100;
      padding: 16px 24px;
      background: rgba(10, 10, 10, 0.8);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
    }

    .nav-inner {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 600;
      font-size: 18px;
      color: var(--text-primary);
      text-decoration: none;
    }

    .logo svg {
      width: 24px;
      height: 24px;
      color: var(--accent);
    }

    .nav-links {
      display: flex;
      align-items: center;
      gap: 32px;
    }

    .nav-links a {
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      transition: color 0.2s;
    }

    .nav-links a:hover {
      color: var(--text-primary);
    }

    .nav-cta {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 20px;
      font-family: inherit;
      font-size: 14px;
      font-weight: 500;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      text-decoration: none;
    }

    .btn-ghost {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text-secondary);
    }

    .btn-ghost:hover {
      border-color: var(--border-hover);
      color: var(--text-primary);
    }

    .btn-primary {
      background: var(--accent);
      border: none;
      color: white;
    }

    .btn-primary:hover {
      background: var(--accent-hover);
    }

    .btn-large {
      padding: 14px 28px;
      font-size: 16px;
    }

    /* Hero Section */
    .hero {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 120px 24px 80px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }

    .hero::before {
      content: '';
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 800px;
      height: 600px;
      background: radial-gradient(ellipse at center, var(--accent-subtle) 0%, transparent 70%);
      pointer-events: none;
    }

    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border);
      border-radius: 100px;
      font-size: 13px;
      color: var(--text-secondary);
      margin-bottom: 24px;
    }

    .hero-badge span {
      color: var(--accent);
      font-weight: 500;
    }

    .hero h1 {
      font-size: clamp(40px, 8vw, 72px);
      font-weight: 700;
      line-height: 1.1;
      letter-spacing: -0.02em;
      max-width: 900px;
      margin-bottom: 24px;
    }

    .hero h1 .gradient {
      background: linear-gradient(135deg, var(--accent) 0%, #fb923c 50%, var(--accent) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .hero-sub {
      font-size: 18px;
      color: var(--text-secondary);
      max-width: 600px;
      margin-bottom: 40px;
      line-height: 1.7;
    }

    .hero-cta {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 64px;
    }

    /* Email Demo */
    .email-demo {
      width: 100%;
      max-width: 700px;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      text-align: left;
      position: relative;
      z-index: 1;
    }

    .email-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      background: var(--bg-tertiary);
      border-bottom: 1px solid var(--border);
    }

    .email-dots {
      display: flex;
      gap: 6px;
    }

    .email-dots span {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--border);
    }

    .email-dots span:nth-child(1) { background: #ef4444; }
    .email-dots span:nth-child(2) { background: #eab308; }
    .email-dots span:nth-child(3) { background: #22c55e; }

    .email-title {
      flex: 1;
      text-align: center;
      font-size: 13px;
      color: var(--text-tertiary);
    }

    .email-body {
      padding: 24px;
    }

    .email-field {
      display: flex;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid var(--border);
      font-size: 14px;
    }

    .email-field:last-of-type {
      border-bottom: none;
    }

    .email-label {
      color: var(--text-tertiary);
      min-width: 80px;
    }

    .email-value {
      color: var(--text-secondary);
    }

    .email-value.highlight {
      color: var(--accent);
      font-weight: 500;
    }

    .email-content {
      margin-top: 20px;
      padding: 16px;
      background: var(--bg-primary);
      border-radius: 8px;
      font-size: 14px;
      color: var(--text-secondary);
      line-height: 1.8;
    }

    /* Stats Section */
    .stats-section {
      padding: 80px 24px 60px;
      background: var(--bg-secondary);
      border-top: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
    }

    .stats-inner {
      max-width: 1200px;
      margin: 0 auto;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 32px;
    }

    .stat-item {
      text-align: center;
    }

    .stat-value {
      font-size: 48px;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1;
      margin-bottom: 8px;
    }

    .stat-value span {
      color: var(--accent);
    }

    .stat-label {
      font-size: 14px;
      color: var(--text-tertiary);
    }

    /* Features Section */
    .features {
      padding: 80px 24px 60px;
    }

    .features-inner {
      max-width: 1200px;
      margin: 0 auto;
    }

    .section-header {
      text-align: center;
      margin-bottom: 64px;
    }

    .section-label {
      display: inline-block;
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--accent);
      margin-bottom: 16px;
    }

    .section-title {
      font-size: clamp(32px, 5vw, 48px);
      font-weight: 700;
      line-height: 1.2;
      margin-bottom: 16px;
    }

    .section-subtitle {
      font-size: 18px;
      color: var(--text-secondary);
      max-width: 600px;
      margin: 0 auto;
    }

    .features-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
    }

    .feature-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 32px;
      transition: all 0.3s;
    }

    .feature-card:hover {
      border-color: var(--border-hover);
      transform: translateY(-4px);
    }

    .feature-icon {
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--accent-subtle);
      border-radius: 12px;
      margin-bottom: 20px;
    }

    .feature-icon svg {
      width: 24px;
      height: 24px;
      color: var(--accent);
    }

    .feature-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 12px;
    }

    .feature-desc {
      font-size: 14px;
      color: var(--text-secondary);
      line-height: 1.7;
    }

    /* How It Works */
    .how-it-works {
      padding: 80px 24px 40px;
      background: var(--bg-secondary);
      border-top: 1px solid var(--border);
    }

    .how-inner {
      max-width: 1000px;
      margin: 0 auto;
    }

    .steps {
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .step {
      display: grid;
      grid-template-columns: 80px 1fr;
      gap: 40px;
      padding: 40px 0;
      border-bottom: 1px solid var(--border);
    }

    .step:last-child {
      border-bottom: none;
    }

    .step-number {
      width: 64px;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-tertiary);
      border: 1px solid var(--border);
      border-radius: 16px;
      font-size: 24px;
      font-weight: 700;
      color: var(--accent);
    }

    .step-content h3 {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 12px;
    }

    .step-content p {
      font-size: 16px;
      color: var(--text-secondary);
      line-height: 1.7;
    }

    .step-code {
      margin-top: 20px;
      padding: 16px 20px;
      background: var(--bg-primary);
      border: 1px solid var(--border);
      border-radius: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 14px;
      color: var(--text-secondary);
    }

    .step-code .highlight {
      color: var(--accent);
    }

    /* CTA Section */
    .cta-section {
      padding: 60px 24px 120px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }

    .cta-section::before {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 1000px;
      height: 500px;
      background: radial-gradient(ellipse at center, var(--accent-subtle) 0%, transparent 70%);
      pointer-events: none;
    }

    .cta-inner {
      max-width: 700px;
      margin: 0 auto;
      position: relative;
      z-index: 1;
    }

    .cta-section h2 {
      font-size: clamp(36px, 6vw, 56px);
      font-weight: 700;
      line-height: 1.2;
      margin-bottom: 20px;
    }

    .cta-section p {
      font-size: 18px;
      color: var(--text-secondary);
      margin-bottom: 40px;
    }

    .cta-buttons {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
    }

    /* Footer */
    footer {
      padding: 48px 24px;
      border-top: 1px solid var(--border);
    }

    .footer-inner {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .footer-logo {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 600;
      color: var(--text-secondary);
    }

    .footer-logo svg {
      width: 20px;
      height: 20px;
      color: var(--accent);
    }

    .footer-links {
      display: flex;
      align-items: center;
      gap: 32px;
    }

    .footer-links a {
      color: var(--text-tertiary);
      text-decoration: none;
      font-size: 14px;
      transition: color 0.2s;
    }

    .footer-links a:hover {
      color: var(--text-secondary);
    }

    /* Responsive */
    @media (max-width: 1024px) {
      .features-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      
      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 48px;
      }
    }

    @media (max-width: 768px) {
      .nav-links {
        display: none;
      }

      .hero h1 {
        font-size: 36px;
      }

      .hero-cta {
        flex-direction: column;
        width: 100%;
      }

      .hero-cta .btn {
        width: 100%;
      }

      .features-grid {
        grid-template-columns: 1fr;
      }

      .feature-card {
        padding: 16px;
        display: grid;
        grid-template-columns: 36px 1fr;
        grid-template-rows: auto auto;
        gap: 8px 12px;
      }

      .feature-icon {
        width: 36px;
        height: 36px;
        margin-bottom: 0;
        grid-row: 1;
        grid-column: 1;
        align-self: center;
      }

      .feature-icon svg {
        width: 18px;
        height: 18px;
      }

      .feature-title {
        font-size: 15px;
        margin-bottom: 0;
        grid-row: 1;
        grid-column: 2;
        align-self: center;
      }

      .feature-desc {
        font-size: 13px;
        line-height: 1.5;
        grid-row: 2;
        grid-column: 1 / -1;
      }

      .pricing-cards {
        grid-template-columns: 1fr;
      }

      .step {
        display: grid;
        grid-template-columns: 48px 1fr;
        grid-template-rows: auto auto;
        gap: 8px 12px;
        padding: 24px 0;
      }

      .step-number {
        width: 48px;
        height: 48px;
        font-size: 18px;
        grid-row: 1;
        grid-column: 1;
        align-self: center;
      }

      .step-content {
        display: contents;
      }

      .step-content h3 {
        font-size: 18px;
        grid-row: 1;
        grid-column: 2;
        align-self: center;
        margin-bottom: 0;
      }

      .step-content p {
        font-size: 14px;
        grid-row: 2;
        grid-column: 1 / -1;
      }

      .step-code {
        grid-row: 3;
        grid-column: 1 / -1;
        font-size: 12px;
        padding: 12px 14px;
      }

      .stats-grid {
        grid-template-columns: 1fr;
        gap: 32px;
      }

      .footer-inner {
        flex-direction: column;
        gap: 24px;
        text-align: center;
      }

      .cta-buttons {
        flex-direction: column;
        width: 100%;
      }

      .cta-buttons .btn {
        width: 100%;
      }
    }

    /* Bug Report Section */
    .bug-report-section {
      padding: 40px 24px 64px;
      background: var(--bg-secondary);
    }

    .bug-report-inner {
      max-width: 600px;
      margin: 0 auto;
      display: flex;
      align-items: flex-start;
      gap: 24px;
      padding: 32px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
    }

    .bug-report-icon {
      flex-shrink: 0;
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--accent-subtle);
      border-radius: 12px;
    }

    .bug-report-icon svg {
      width: 24px;
      height: 24px;
      color: var(--accent);
    }

    .bug-report-content h3 {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .bug-report-content p {
      font-size: 14px;
      color: var(--text-secondary);
      line-height: 1.7;
      margin-bottom: 16px;
    }

    .bug-report-content .btn {
      padding: 8px 16px;
      font-size: 14px;
    }

    @media (max-width: 768px) {
      .bug-report-inner {
        flex-direction: column;
        text-align: center;
        align-items: center;
      }
    }

    /* Animations */
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }

    @keyframes pulse-glow {
      0%, 100% { opacity: 0.4; transform: scale(1); }
      50% { opacity: 0.8; transform: scale(1.05); }
    }

    @keyframes rotate-slow {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @keyframes dash {
      to { stroke-dashoffset: 0; }
    }

    @keyframes fade-in-up {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes particle-float {
      0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
      25% { transform: translateY(-20px) translateX(10px); opacity: 0.6; }
      50% { transform: translateY(-10px) translateX(-5px); opacity: 0.4; }
      75% { transform: translateY(-30px) translateX(15px); opacity: 0.5; }
    }

    .email-demo {
      animation: float 6s ease-in-out infinite;
    }

    /* Hero background animation */
    .hero-bg-animation {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      overflow: hidden;
      pointer-events: none;
      z-index: 0;
    }

    .hero-bg-animation svg {
      position: absolute;
      opacity: 0.15;
    }

    .floating-calendar {
      width: 60px;
      height: 60px;
      top: 20%;
      left: 10%;
      animation: float 8s ease-in-out infinite, rotate-slow 20s linear infinite;
    }

    .floating-clock {
      width: 40px;
      height: 40px;
      top: 30%;
      right: 15%;
      animation: float 6s ease-in-out infinite 1s;
    }

    .floating-check {
      width: 35px;
      height: 35px;
      bottom: 30%;
      left: 15%;
      animation: float 7s ease-in-out infinite 0.5s;
    }

    .floating-mail {
      width: 50px;
      height: 50px;
      bottom: 25%;
      right: 10%;
      animation: float 9s ease-in-out infinite 2s;
    }

    /* Animated gradient orbs */
    .gradient-orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      animation: pulse-glow 8s ease-in-out infinite;
    }

    .orb-1 {
      width: 400px;
      height: 400px;
      background: var(--accent);
      top: -100px;
      left: -100px;
      opacity: 0.15;
    }

    .orb-2 {
      width: 300px;
      height: 300px;
      background: var(--purple);
      bottom: -50px;
      right: -50px;
      opacity: 0.1;
      animation-delay: 2s;
    }

    .orb-3 {
      width: 200px;
      height: 200px;
      background: var(--blue);
      top: 40%;
      right: 20%;
      opacity: 0.1;
      animation-delay: 4s;
    }

    /* Animated line connecting steps */
    .step-line {
      position: absolute;
      left: 32px;
      top: 80px;
      bottom: 0;
      width: 2px;
      background: linear-gradient(to bottom, var(--accent) 0%, transparent 100%);
      opacity: 0.3;
    }

    .steps {
      position: relative;
    }

    /* Feature card hover glow */
    .feature-card {
      position: relative;
      overflow: hidden;
    }

    .feature-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), var(--accent-subtle) 0%, transparent 50%);
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
    }

    .feature-card:hover::before {
      opacity: 1;
    }

    /* Animated checkmark for features */
    .feature-icon svg.animated-check path {
      stroke-dasharray: 100;
      stroke-dashoffset: 100;
    }

    .feature-card:hover .feature-icon svg.animated-check path {
      animation: dash 0.5s ease forwards;
    }

    /* Stats counter effect */
    .stat-value {
      position: relative;
    }

    .stat-value::after {
      content: '';
      position: absolute;
      bottom: -4px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 2px;
      background: var(--accent);
      transition: width 0.3s ease;
    }

    .stat-item:hover .stat-value::after {
      width: 40px;
    }

    /* Particles */
    .particles {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      overflow: hidden;
      pointer-events: none;
    }

    .particle {
      position: absolute;
      width: 4px;
      height: 4px;
      background: var(--accent);
      border-radius: 50%;
      opacity: 0.3;
    }

    .particle:nth-child(1) { top: 20%; left: 20%; animation: particle-float 12s infinite; }
    .particle:nth-child(2) { top: 60%; left: 80%; animation: particle-float 15s infinite 2s; }
    .particle:nth-child(3) { top: 40%; left: 40%; animation: particle-float 10s infinite 1s; }
    .particle:nth-child(4) { top: 80%; left: 60%; animation: particle-float 14s infinite 3s; }
    .particle:nth-child(5) { top: 10%; left: 70%; animation: particle-float 11s infinite 0.5s; }
    .particle:nth-child(6) { top: 70%; left: 30%; animation: particle-float 13s infinite 2.5s; }

    /* CTA animated border */
    .cta-inner {
      position: relative;
    }

    .cta-section .btn-primary {
      position: relative;
      overflow: hidden;
    }

    .cta-section .btn-primary::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
      animation: shimmer 3s infinite;
    }

    @keyframes shimmer {
      0% { left: -100%; }
      100% { left: 100%; }
    }

    /* Page load animations */
    .hero h1, .hero-sub, .hero-cta, .hero-badge {
      animation: fade-in-up 0.8s ease forwards;
      opacity: 0;
    }

    .hero-badge { animation-delay: 0.1s; }
    .hero h1 { animation-delay: 0.2s; }
    .hero-sub { animation-delay: 0.3s; }
    .hero-cta { animation-delay: 0.4s; }
    .email-demo { animation: fade-in-up 0.8s ease forwards 0.5s, float 6s ease-in-out infinite 1.3s; opacity: 0; }
  </style>
</head>
<body>
  <!-- Navigation -->
  <nav>
    <div class="nav-inner">
      <a href="/" class="logo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        InboxBuddy
      </a>
      <div class="nav-links">
        <a href="#features">Features</a>
        <a href="#how-it-works">How it Works</a>

        
      </div>
      <div class="nav-cta">
        <a href="https://github.com/whoiskatrin/inboxbuddy" target="_blank" class="btn btn-ghost">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          Star on GitHub
        </a>
        <a href="/auth/google" class="btn btn-primary">
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Login with Google
        </a>
      </div>
    </div>
  </nav>

  <!-- Hero Section -->
  <section class="hero">
    <!-- Animated background -->
    <div class="hero-bg-animation">
      <div class="gradient-orb orb-1"></div>
      <div class="gradient-orb orb-2"></div>
      <div class="gradient-orb orb-3"></div>
      
      <!-- Floating icons -->
      <svg class="floating-calendar" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      
      <svg class="floating-clock" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      
      <svg class="floating-check" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="1.5">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
      
      <svg class="floating-mail" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="1.5">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
      </svg>

      <!-- Particles -->
      <div class="particles">
        <div class="particle"></div>
        <div class="particle"></div>
        <div class="particle"></div>
        <div class="particle"></div>
        <div class="particle"></div>
        <div class="particle"></div>
      </div>
    </div>

    <div class="hero-badge">
      <span>Beta</span> Product still in development
    </div>
    <h1>
      Scheduling meetings<br>
      <span class="gradient">shouldn't be a meeting</span>
    </h1>
    <p class="hero-sub">
      Just CC meetme@ in any email thread. Your AI assistant checks calendars, 
      proposes times, and books the meeting. No more back-and-forth.
    </p>
    <div class="hero-cta">
      <a href="/auth/google" class="btn btn-primary btn-large">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
        Start for free
      </a>
      <a href="#how-it-works" class="btn btn-ghost btn-large">See how it works</a>
    </div>

    <!-- Email Demo -->
    <div class="email-demo">
      <div class="email-header">
        <div class="email-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div class="email-title">New Message</div>
        <div style="width: 42px"></div>
      </div>
      <div class="email-body">
        <div class="email-field">
          <span class="email-label">To:</span>
          <span class="email-value">kate@company.com</span>
        </div>
        <div class="email-field">
          <span class="email-label">Cc:</span>
          <span class="email-value highlight">meetme@inboxbuddy.dev</span>
        </div>
        <div class="email-field">
          <span class="email-label">Subject:</span>
          <span class="email-value">Quick sync on Q1 roadmap</span>
        </div>
        <div class="email-content">
          Hey Kate!<br><br>
          Would love to chat about the upcoming roadmap sometime this week.
          Let me know what works for you!<br><br>
          Best,<br>
          Alex
        </div>
      </div>
    </div>
  </section>

  <!-- Stats Section -->
  <section class="stats-section">
    <div class="stats-inner">
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value"><span>3</span>sec</div>
          <div class="stat-label">Average response time</div>
        </div>
        <div class="stat-item">
          <div class="stat-value"><span>0</span></div>
          <div class="stat-label">Emails to schedule a meeting</div>
        </div>
        <div class="stat-item">
          <div class="stat-value"><span>100</span>%</div>
          <div class="stat-label">Privacy-focused on edge</div>
        </div>
        <div class="stat-item">
          <div class="stat-value"><span>24</span>/7</div>
          <div class="stat-label">Always available globally</div>
        </div>
      </div>
    </div>
  </section>

  <!-- Features Section -->
  <section class="features" id="features">
    <div class="features-inner">
      <div class="section-header">
        <div class="section-label">Features</div>
        <h2 class="section-title">Everything you need to stop scheduling</h2>
        <p class="section-subtitle">
          InboxBuddy handles the entire scheduling workflow so you can focus on what matters.
        </p>
      </div>
      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </div>
          <h3 class="feature-title">Email-first workflow</h3>
          <p class="feature-desc">
            Just CC meetme@ in any email. Works with Gmail (Outlook coming soon). No apps to install.
          </p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <h3 class="feature-title">AI-powered understanding</h3>
          <p class="feature-desc">
            Claude understands context, urgency, and preferences. It proposes times that actually make sense.
          </p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <h3 class="feature-title">Real-time calendar sync</h3>
          <p class="feature-desc">
            Checks your Google Calendar in real-time to find open slots that respect your working hours.
          </p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <h3 class="feature-title">Automatic booking</h3>
          <p class="feature-desc">
            Once a time is confirmed, InboxBuddy creates the calendar event and sends invites automatically.
          </p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <h3 class="feature-title">Privacy by design</h3>
          <p class="feature-desc">
            Runs on Cloudflare's edge. Your data never leaves the network. No training on your emails.
          </p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </div>
          <h3 class="feature-title">Customizable preferences</h3>
          <p class="feature-desc">
            Set your timezone, working hours, meeting buffer, and more from the dashboard.
          </p>
        </div>
      </div>
    </div>
  </section>

  <!-- How It Works -->
  <section class="how-it-works" id="how-it-works">
    <div class="how-inner">
      <div class="section-header">
        <div class="section-label">How It Works</div>
        <h2 class="section-title">Three steps to freedom</h2>
        <p class="section-subtitle">
          Stop wasting time on scheduling. Here's how InboxBuddy handles it for you.
        </p>
      </div>
      <div class="steps">
        <div class="step">
          <div class="step-number">1</div>
          <div class="step-content">
            <h3>CC InboxBuddy in your email</h3>
            <p>
              When you're discussing a meeting with someone, just add your InboxBuddy address to the CC field. 
              That's it - no special syntax or commands needed.
            </p>
            <div class="step-code">
              Cc: <span class="highlight">meetme@inboxbuddy.dev</span>
            </div>
          </div>
        </div>
        <div class="step">
          <div class="step-number">2</div>
          <div class="step-content">
            <h3>AI proposes available times</h3>
            <p>
              InboxBuddy instantly checks your calendar, understands the context of your email, 
              and replies to everyone with 3-4 time slots that work with your schedule.
            </p>
            <div class="step-code">
              "Based on Jordan's availability, here are some times that work:<br>
              <span class="highlight">1. Tuesday 2:00 PM - 2:30 PM</span><br>
              <span class="highlight">2. Wednesday 10:00 AM - 10:30 AM</span><br>
              <span class="highlight">3. Thursday 3:00 PM - 3:30 PM</span>"
            </div>
          </div>
        </div>
        <div class="step">
          <div class="step-number">3</div>
          <div class="step-content">
            <h3>Confirm and it's booked</h3>
            <p>
              Anyone can reply with their preferred time. InboxBuddy creates the calendar event, 
              sends invites to all participants, and you're done.
            </p>
            <div class="step-code">
              <span class="highlight">Calendar event created:</span> "Quick sync on Q1 roadmap"<br>
              Tuesday, Jan 14 at 2:00 PM - Invites sent to all participants
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Bug Report Section -->
  <section class="bug-report-section">
    <div class="bug-report-inner">
      <div class="bug-report-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
          <line x1="4" y1="22" x2="4" y2="15"/>
        </svg>
      </div>
      <div class="bug-report-content">
        <h3>Found a bug?</h3>
        <p>
          This project is in early development. If you run into any issues or have feedback, 
          reach out to me on X. I'd love to hear from you!
        </p>
        <a href="https://x.com/whoiskatrin" target="_blank" class="btn btn-ghost">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          @whoiskatrin
        </a>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer>
    <div class="footer-inner">
      <div class="footer-logo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        InboxBuddy
      </div>
      <div class="footer-links">
        <a href="#features">Features</a>

        
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
      </div>
    </div>
  </footer>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
