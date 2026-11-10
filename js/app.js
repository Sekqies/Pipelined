/**
 * PIPELINED - Main Application Controller
 * Handles Theme Switching (Terminal DOS/Fallout vs Windows 99),
 * Boot Screen Animation, Interactive Terminal CLI, and Win99 Desktop Window Manager.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const bootScreen = document.getElementById('boot-screen');
  const bootSkipBtn = document.getElementById('boot-skip-btn');
  const bootLog = document.getElementById('boot-log');
  const themeToggleBtns = document.querySelectorAll('.action-toggle-theme');
  const soundToggleBtns = document.querySelectorAll('.action-toggle-sound');
  const termPromptInput = document.getElementById('term-prompt-input');

  // Win99 elements
  const startBtn = document.getElementById('win-start-btn');
  const startMenu = document.getElementById('win-start-menu');
  const winClock = document.getElementById('win-clock');
  const desktopIcons = document.querySelectorAll('.win-icon');

  // Google Forms evaluation URL
  const evalFormUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSd2PKAUMBu_cE8NeRLMPDn3qTEC0weKkAtMepgD3cqrVn2QXg/viewform';

  // Modal de avaliação (prompt ao entrar no site)
  const evalModal = document.getElementById('eval-modal-backdrop');

  function closeEvalModal() {
    SoundEngine.click();
    if (evalModal) {
      evalModal.classList.add('hidden');
    }
  }

  document.querySelectorAll('.eval-modal-close').forEach(btn => {
    btn.addEventListener('click', closeEvalModal);
  });

  // Default theme: Windows 99 (alternativo: Terminal DOS)
  let currentTheme = localStorage.getItem('pipelined_theme');
  if (!localStorage.getItem('pipelined_v3_default')) {
    currentTheme = 'win99';
    localStorage.setItem('pipelined_theme', 'win99');
    localStorage.setItem('pipelined_v3_default', 'true');
  }
  if (!currentTheme) {
    currentTheme = 'win99';
  }

  // Apply initial theme
  setTheme(currentTheme, false);

  // Initialize Simulator
  if (window.PipelineSimulator) {
    PipelineSimulator.init();
  }

  // Clock in Windows 99 Taskbar
  function updateClock() {
    if (winClock) {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      winClock.textContent = `${h}:${m}`;
    }
  }
  updateClock();
  setInterval(updateClock, 1000);

  // --------------------------------------------------------------------------
  // Boot Animation Sequence
  // --------------------------------------------------------------------------
  const bootLines = [
    'RV32I ROM BIOS v1.04 - USP LARC/PCS INITIALIZED',
    'DETECTING HARDWARE: 4 HARNESS PEONS CONNECTED',
    'REGISTER BANK: x1, x2, x3, x4 INITIALIZED TO ZERO (0)',
    'DATA MEMORY: M1..M5 CONFIGURED (5 HIDDEN TOKENS LOADED)',
    'INSTRUCTION MEMORY DECK: 60 CARDS LOADED',
    'CONTROL UNIT (UC) DECK: 12 FLAGS LOADED',
    'PIPELINE STAGES: IF | ID | EX | MEM | WB OPERATIONAL',
    'CHECKING HAZARDS: 3-STAGE GAP (RAMO B) VERIFIED',
    'CARREGANDO MASCOTE PIPELINED...',
    'SISTEMA PRONTO: SEJA BEM-VINDO AO PIPELINED!'
  ];

  let bootIndex = 0;
  let bootInterval = null;

  function endBootScreen() {
    if (bootInterval) clearInterval(bootInterval);
    if (bootScreen) {
      bootScreen.classList.add('hidden');
      setTimeout(() => {
        bootScreen.style.display = 'none';
      }, 500);
    }
    SoundEngine.bootChime();
    if (termPromptInput) termPromptInput.focus();
  }

  if (sessionStorage.getItem('pipelined_booted')) {
    // Already seen in this session, skip quickly
    if (bootScreen) bootScreen.style.display = 'none';
  } else {
    sessionStorage.setItem('pipelined_booted', 'true');
    bootInterval = setInterval(() => {
      if (bootIndex < bootLines.length) {
        const line = document.createElement('div');
        line.textContent = `> ${bootLines[bootIndex]}`;
        if (bootLog) {
          bootLog.appendChild(line);
          bootLog.scrollTop = bootLog.scrollHeight;
        }
        SoundEngine.blip();
        bootIndex++;
      } else {
        clearInterval(bootInterval);
        setTimeout(endBootScreen, 1200);
      }
    }, 280);
  }

  if (bootSkipBtn) {
    bootSkipBtn.addEventListener('click', endBootScreen);
  }
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && bootScreen && !bootScreen.classList.contains('hidden')) {
      endBootScreen();
    }
  });

  // --------------------------------------------------------------------------
  // Theme Switching: Terminal DOS vs Windows 99
  // --------------------------------------------------------------------------
  function setTheme(theme, playSound = true) {
    currentTheme = theme;
    localStorage.setItem('pipelined_theme', theme);
    document.body.classList.remove('theme-terminal', 'theme-win99');
    document.body.classList.add(`theme-${theme}`);

    const terminalContainer = document.getElementById('terminal-view');
    const win99Container = document.getElementById('win99-view');

    if (theme === 'terminal') {
      if (terminalContainer) terminalContainer.style.display = 'block';
      if (win99Container) win99Container.style.display = 'none';
    } else {
      if (terminalContainer) terminalContainer.style.display = 'none';
      if (win99Container) win99Container.style.display = 'block';
    }

    // Update button labels
    themeToggleBtns.forEach(btn => {
      if (theme === 'terminal') {
        btn.innerHTML = '&#128452; Trocar para Modo Windows 99';
        btn.setAttribute('title', 'Alternar interface gráfica retrô Windows 99');
      } else {
        btn.innerHTML = '&gt;_ Trocar para Terminal DOS';
        btn.setAttribute('title', 'Alternar terminal retrô estilo Fallout / DOS');
      }
    });

    if (playSound) SoundEngine.beep();
  }

  themeToggleBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      setTheme(currentTheme === 'terminal' ? 'win99' : 'terminal');
    });
  });

  // Sound Toggles
  soundToggleBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const enabled = SoundEngine.toggle();
      soundToggleBtns.forEach(b => {
        b.innerHTML = enabled ? '&#128266; Som: Ligado' : '&#128263; Som: Mudo';
      });
    });
  });

  // --------------------------------------------------------------------------
  // Interactive Terminal Command Parser
  // --------------------------------------------------------------------------
  if (termPromptInput) {
    termPromptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const cmd = termPromptInput.value.trim().toLowerCase();
        termPromptInput.value = '';
        executeTerminalCommand(cmd);
      }
    });
  }

  // Clickable quick command buttons
  document.querySelectorAll('.term-quick-cmd').forEach(item => {
    item.addEventListener('click', () => {
      const cmd = item.getAttribute('data-cmd');
      if (cmd) executeTerminalCommand(cmd);
    });
  });

  function executeTerminalCommand(cmd) {
    SoundEngine.click();
    const cleanCmd = cmd.replace(/^>/, '').trim();

    if (!cleanCmd) return;

    if (cleanCmd === 'ajuda' || cleanCmd === 'help') {
      alert('COMANDOS DISPONÍVEIS:\n- avaliar: Abrir o formulário Google Forms para avaliar o trabalho\n- regras: Rolar até o manual de regras\n- cartas: Ver galeria de cartas do jogo\n- arquitetura: Explicação da conexão com Pipeline RISC-V\n- tabuleiro: Visualizar o tabuleiro do circuito\n- simulador: Abrir simulador de branches e hazards\n- autores: Ver créditos dos estudantes da USP\n- win99: Alternar para interface Windows 99\n- github: Abrir o repositório oficial do projeto\n- som: Ligar ou desligar áudio');
      return;
    }

    if (cleanCmd === 'avaliar' || cleanCmd === 'forms' || cleanCmd === 'formulario') {
      window.open(evalFormUrl, '_blank');
      return;
    }

    if (cleanCmd === 'regras') {
      scrollToSection('sec-regras');
    } else if (cleanCmd === 'cartas') {
      scrollToSection('sec-cartas');
    } else if (cleanCmd === 'arquitetura') {
      scrollToSection('sec-arquitetura');
    } else if (cleanCmd === 'tabuleiro') {
      scrollToSection('sec-tabuleiro');
    } else if (cleanCmd === 'simulador') {
      scrollToSection('sec-simulador');
    } else if (cleanCmd === 'autores' || cleanCmd === 'creditos') {
      scrollToSection('sec-autores');
    } else if (cleanCmd === 'win99' || cleanCmd === 'windows' || cleanCmd === 'gui') {
      setTheme('win99');
    } else if (cleanCmd === 'terminal' || cleanCmd === 'dos') {
      setTheme('terminal');
    } else if (cleanCmd === 'github') {
      window.open('https://github.com/Sekqies/Pipelined', '_blank');
    } else if (cleanCmd === 'som') {
      SoundEngine.toggle();
    } else {
      alert(`Comando não reconhecido: "${cleanCmd}". Digite "ajuda" para ver comandos disponíveis.`);
    }
  }

  function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // --------------------------------------------------------------------------
  // Card Flip and Filter Mechanics
  // --------------------------------------------------------------------------
  document.querySelectorAll('.card-flip-container').forEach(card => {
    card.addEventListener('click', () => {
      SoundEngine.click();
      card.classList.toggle('flipped');
    });
  });

  // Filter cards by category
  document.querySelectorAll('.term-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      SoundEngine.click();
      document.querySelectorAll('.term-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.getAttribute('data-filter');
      document.querySelectorAll('.term-card-item').forEach(card => {
        const cat = card.getAttribute('data-category');
        if (filter === 'all' || cat === filter) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  // --------------------------------------------------------------------------
  // Windows 99 Desktop & Window Manager
  // --------------------------------------------------------------------------
  if (startBtn && startMenu) {
    startBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      SoundEngine.click();
      startMenu.classList.toggle('hidden');
      startBtn.classList.toggle('depressed');
    });

    document.addEventListener('click', (e) => {
      if (!startMenu.contains(e.target) && e.target !== startBtn) {
        startMenu.classList.add('hidden');
        startBtn.classList.remove('depressed');
      }
    });
  }

  // Start Menu item clicks
  document.querySelectorAll('.win-start-item').forEach(item => {
    item.addEventListener('click', () => {
      SoundEngine.click();
      const targetWin = item.getAttribute('data-window');
      const action = item.getAttribute('data-action');

      if (targetWin) {
        openWin99Window(targetWin);
      } else if (action === 'switch-term') {
        setTheme('terminal');
      } else if (action === 'open-github') {
        window.open('https://github.com/Sekqies/Pipelined', '_blank');
      } else if (action === 'open-form') {
        window.open(evalFormUrl, '_blank');
      }
      startMenu.classList.add('hidden');
      startBtn.classList.remove('depressed');
    });
  });

  // Desktop Icons Click
  desktopIcons.forEach(icon => {
    icon.addEventListener('click', () => {
      SoundEngine.click();
      desktopIcons.forEach(i => i.classList.remove('selected'));
      icon.classList.add('selected');
      const targetWin = icon.getAttribute('data-window');
      const action = icon.getAttribute('data-action');
      if (targetWin) openWin99Window(targetWin);
      else if (action === 'switch-term') setTheme('terminal');
      else if (action === 'open-github') window.open('https://github.com/Sekqies/Pipelined', '_blank');
      else if (action === 'open-form') window.open(evalFormUrl, '_blank');
    });
  });

  // Taskbar Items Click
  document.querySelectorAll('.win-task-item').forEach(item => {
    item.addEventListener('click', () => {
      SoundEngine.click();
      const targetWin = item.getAttribute('data-window');
      if (targetWin) openWin99Window(targetWin);
    });
  });

  // Window Controls (Minimize, Maximize, Close)
  let highestZ = 100;

  function focusWindow(win) {
    highestZ++;
    win.style.zIndex = highestZ;
    document.querySelectorAll('.win-window').forEach(w => {
      const tb = w.querySelector('.win-titlebar');
      if (tb) tb.classList.add('inactive');
    });
    const activeTb = win.querySelector('.win-titlebar');
    if (activeTb) activeTb.classList.remove('inactive');
  }

  function openWin99Window(winId) {
    const win = document.getElementById(winId);
    if (!win) return;
    win.classList.remove('minimized');
    focusWindow(win);
    win.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  document.querySelectorAll('.win-window').forEach(win => {
    win.addEventListener('mousedown', () => focusWindow(win));

    const closeBtn = win.querySelector('.win-ctl-close');
    const minBtn = win.querySelector('.win-ctl-min');

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        SoundEngine.click();
        win.classList.add('minimized');
      });
    }

    if (minBtn) {
      minBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        SoundEngine.click();
        win.classList.add('minimized');
      });
    }
  });

  // Win99 Tab Controls inside Windows
  document.querySelectorAll('.win-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      SoundEngine.click();
      const parent = tab.closest('.win-window');
      if (!parent) return;

      parent.querySelectorAll('.win-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const targetPane = tab.getAttribute('data-pane');
      parent.querySelectorAll('.win-tab-pane').forEach(p => {
        if (p.getAttribute('data-pane') === targetPane) {
          p.style.display = 'block';
        } else {
          p.style.display = 'none';
        }
      });
    });
  });

  // Win99 Simulator Buttons Wiring
  document.querySelectorAll('.btn-sim-inc').forEach(btn => {
    btn.addEventListener('click', () => {
      const reg = btn.getAttribute('data-reg');
      PipelineSimulator.setRegister(reg, 1);
    });
  });

  document.querySelectorAll('.btn-sim-dec').forEach(btn => {
    btn.addEventListener('click', () => {
      const reg = btn.getAttribute('data-reg');
      PipelineSimulator.setRegister(reg, -1);
    });
  });

  const btnCycle1 = document.getElementById('btn-branch-c1');
  const btnCycle2 = document.getElementById('btn-branch-c2');
  const btnAdversary = document.getElementById('btn-adversary');
  const btnReset = document.getElementById('btn-sim-reset');

  if (btnCycle1) {
    btnCycle1.addEventListener('click', () => {
      const instr = document.getElementById('sel-branch-instr').value;
      const regA = document.getElementById('sel-branch-rega').value;
      const regB = document.getElementById('sel-branch-regb').value;
      const target = document.getElementById('sel-branch-target').value;
      PipelineSimulator.prepareBranch(instr, regA, regB, target);
    });
  }

  if (btnAdversary) {
    btnAdversary.addEventListener('click', () => {
      PipelineSimulator.simulateAdversaryInterference();
    });
  }

  if (btnCycle2) {
    btnCycle2.addEventListener('click', () => {
      PipelineSimulator.resolveBranch();
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      PipelineSimulator.reset();
    });
  }
});
