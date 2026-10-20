// Activation requires continuous proximity; charging continues after leaving.
export function advanceOverload(terminal, dt, near) {
  if (!Number.isFinite(dt) || dt <= 0 || terminal.state === 'done') return;
  if (terminal.state === 'idle') {
    terminal.arm = near ? Math.min(2, terminal.arm + dt) : 0;
    if (terminal.arm >= 2) terminal.state = 'active';
    return;
  }
  terminal.remaining = Math.max(0, terminal.remaining - dt);
  if (terminal.remaining === 0) terminal.state = 'done';
}

export function overloadSpawnInterval(terminals) {
  const active = terminals.filter(t => t.state === 'active').length;
  return 2.4 / (1 + active * 0.5);
}
