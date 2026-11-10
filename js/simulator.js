/**
 * PIPELINED - Interactive RISC-V Pipeline & Branch Simulator
 * Implements the exact game mechanics and hardware dataflow connection
 */

const PipelineSimulator = (function() {
  // Registers x1..x4 (range 0..8)
  const registers = { x1: 2, x2: 5, x3: 0, x4: 3 };
  const memory = { M1: 4, M2: 7, M3: 1, M4: 6, M5: 0 };

  let activeBranch = null; // { instr, regA, regB, target, turn: 1 }

  function clampArithmetic(val) {
    if (val > 8) return 0; // Game rule: overflow past 8 returns to 0
    if (val < 0) return 0; // Game rule: underflow below 0 returns to 0
    return val;
  }

  function updateRegDisplay() {
    ['x1', 'x2', 'x3', 'x4'].forEach(r => {
      const elTerm = document.getElementById(`sim-val-${r}`);
      const elWin = document.getElementById(`win-sim-val-${r}`);
      if (elTerm) elTerm.textContent = registers[r];
      if (elWin) elWin.textContent = registers[r];
    });
  }

  function logConsole(msg, isSuccess = null) {
    const termLog = document.getElementById('term-sim-log');
    const winLog = document.getElementById('win-sim-log');

    const line = document.createElement('div');
    line.className = 'sim-log-line';
    if (isSuccess === true) line.style.color = '#33ff33';
    else if (isSuccess === false) line.style.color = '#ff4444';
    else line.style.color = '#aaa';

    line.innerHTML = `&gt; ${msg}`;

    if (termLog) {
      termLog.appendChild(line);
      termLog.scrollTop = termLog.scrollHeight;
    }
    if (winLog) {
      const winLine = line.cloneNode(true);
      if (isSuccess === true) winLine.style.color = '#008000';
      else if (isSuccess === false) winLine.style.color = '#cc0000';
      else winLine.style.color = '#222';
      winLog.appendChild(winLine);
      winLog.scrollTop = winLog.scrollHeight;
    }
  }

  return {
    init() {
      updateRegDisplay();
      logConsole('Simulador de Pipeline inicializado. Registradores compartilhados prontos (0 a 8).');
    },

    setRegister(reg, delta) {
      SoundEngine.click();
      registers[reg] = Math.max(0, Math.min(8, registers[reg] + delta));
      updateRegDisplay();
      logConsole(`Registrador [${reg}] alterado para ${registers[reg]}`);
    },

    executeArithmetic(op, dest, src, imm = 0) {
      SoundEngine.click();
      const prev = registers[dest];
      if (op === 'addi') {
        registers[dest] = clampArithmetic(registers[dest] + imm);
        logConsole(`EXEC: addi ${dest}, ${dest}, +${imm} | ${prev} + ${imm} =&gt; ${registers[dest]} (regra 0..8)`);
      } else if (op === 'add') {
        const addend = registers[src];
        registers[dest] = clampArithmetic(registers[dest] + addend);
        logConsole(`EXEC: add ${dest}, ${dest}, ${src} | ${prev} + ${addend} =&gt; ${registers[dest]}`);
      } else if (op === 'sub') {
        const subtrahend = registers[src];
        registers[dest] = clampArithmetic(registers[dest] - subtrahend);
        logConsole(`EXEC: sub ${dest}, ${dest}, ${src} | ${prev} - ${subtrahend} =&gt; ${registers[dest]}`);
      }
      updateRegDisplay();
    },

    prepareBranch(instr, regA, regB, target) {
      SoundEngine.click();
      activeBranch = { instr, regA, regB, target };
      logConsole(`--------------------------------------------------`);
      logConsole(`CICLO 1 [FETCH/DECODE]: Anunciado desvio: ${instr} ${regA}, ${regB}, ${target}`);
      logConsole(`STATUS: Peão travado por 1 turno (Pipeline Hazard / Bolha de Branch). O destino ${target} está fixado.`);
      logConsole(`DICA DIDÁTICA: Durante este intervalo, outros jogadores podem alterar ${regA} ou ${regB} nos registradores compartilhados!`);

      const statusEl = document.getElementById('branch-cycle-status');
      if (statusEl) {
        statusEl.textContent = `Ciclo 1 Ativo: Preparando ${instr} ${regA}, ${regB} -&gt; ${target}`;
        statusEl.className = 'sim-status-banner term-alert';
      }
    },

    simulateAdversaryInterference() {
      SoundEngine.blip();
      // Simulate opponent playing ADDI or SUB on regA or regB
      const targetReg = activeBranch ? activeBranch.regA : 'x1';
      const prev = registers[targetReg];
      registers[targetReg] = registers[targetReg] >= 5 ? 1 : 7;
      updateRegDisplay();
      logConsole(`INTERFERÊNCIA DE ADVERSÁRIO! Outro jogador jogou carta alterando [${targetReg}] de ${prev} para ${registers[targetReg]}!`, false);
    },

    resolveBranch() {
      if (!activeBranch) {
        logConsole('Nenhum branch em preparação. Prepare um branch primeiro no Ciclo 1.', false);
        return;
      }

      const { instr, regA, regB, target } = activeBranch;
      const valA = registers[regA];
      const valB = registers[regB];
      let taken = false;

      if (instr === 'blt') {
        taken = valA < valB;
      } else if (instr === 'bgt') {
        taken = valA > valB;
      }

      logConsole(`CICLO 2 [EXECUTE/ALU]: Avaliando condição no hardware: ${valA} ${instr === 'blt' ? '<' : '>'} ${valB}...`);

      if (taken) {
        SoundEngine.branchSuccess();
        logConsole(`✓ SUCESSO! A condição (${valA} ${instr === 'blt' ? '<' : '>'} ${valB}) é VERDADEIRA!`, true);
        logConsole(`DESVIO TOMADO (BRANCH TAKEN): Peão salta para o destino [${target}]! Carta descartada.`, true);
        logConsole(`ARQUITETURA: Em hardware, o PC é atualizado para o endereço de ${target}. Ganho de ciclos no percurso!`, true);
      } else {
        SoundEngine.branchFail();
        logConsole(`✗ FALHA! A condição (${valA} ${instr === 'blt' ? '<' : '>'} ${valB}) é FALSA!`, false);
        logConsole(`DESVIO NÃO TOMADO (BRANCH NOT TAKEN): Peão permanece na casa de origem. Desperdiçou 2 turnos!`, false);
        logConsole(`ARQUITETURA: Modela a Penalidade de Desvio (Branch Penalty). O pipeline gastou 2 ciclos sem avançar no código!`, false);
      }

      activeBranch = null;
      const statusEl = document.getElementById('branch-cycle-status');
      if (statusEl) {
        statusEl.textContent = taken ? `Desvio Tomado para ${target}!` : `Desvio Falhou! Penalidade de 2 turnos sofrida.`;
        statusEl.className = taken ? 'sim-status-banner term-alert info' : 'sim-status-banner term-alert danger';
      }
    },

    reset() {
      registers.x1 = 2;
      registers.x2 = 5;
      registers.x3 = 0;
      registers.x4 = 3;
      activeBranch = null;
      updateRegDisplay();
      logConsole('Simulador resetado para valores iniciais padrão (x1=2, x2=5, x3=0, x4=3).');
      const statusEl = document.getElementById('branch-cycle-status');
      if (statusEl) {
        statusEl.textContent = 'Pronto para iniciar novo ciclo de desvio.';
        statusEl.className = 'sim-status-banner';
      }
    }
  };
})();
