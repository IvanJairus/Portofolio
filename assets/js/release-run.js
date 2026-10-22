(function () {
  'use strict';

  const board = document.querySelector('[data-run-board]');
  if (!board) return;

  const tabs = Array.from(board.querySelectorAll('[data-system-tab]'));
  const panels = Array.from(board.querySelectorAll('[data-system-panel]'));
  const tablist = board.querySelector('.system-tablist');

  const setTabHash = (name) => {
    try {
      window.history.replaceState(null, '', '#system-' + name);
    } catch (error) {
      /* hash updates are optional on restricted contexts */
    }
  };

  const activatePanel = (name, updateHash) => {
    tabs.forEach((tab) => {
      const selected = tab.dataset.systemTab === name;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.systemPanel !== name;
    });
    if (updateHash) setTabHash(name);
    board.dispatchEvent(new CustomEvent('system-view', { detail: name }));
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => activatePanel(tab.dataset.systemTab, true));
  });

  if (tablist) {
    tablist.addEventListener('keydown', (event) => {
      const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
      if (!keys.includes(event.key)) return;
      const current = tabs.indexOf(document.activeElement);
      if (current < 0) return;
      let next = current;
      if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
      if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      event.preventDefault();
      activatePanel(tabs[next].dataset.systemTab, true);
      tabs[next].focus();
    });
  }

  const hashView = ['run', 'board', 'release'].find((name) => window.location.hash === '#system-' + name);
  activatePanel(hashView || 'run', false);
  if (hashView) {
    window.requestAnimationFrame(() => {
      board.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
  }

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce.matches) return;

  const replay = board.querySelector('[data-run-replay]');
  const status = board.querySelector('[data-run-status]');
  const stages = Array.from(board.querySelectorAll('[data-run-stage]'));
  const lines = Array.from(board.querySelectorAll('[data-run-line]'));
  const checks = Array.from(board.querySelectorAll('[data-run-check]'));
  let timers = [];
  let started = false;

  const clearTimers = () => {
    timers.forEach((timer) => window.clearTimeout(timer));
    timers = [];
  };

  const setPhase = (phase) => {
    board.dataset.phase = String(phase);
    stages.forEach((stage, index) => {
      const state = index < phase ? 'passed' : index === phase && phase < 5 ? 'running' : 'queued';
      stage.dataset.state = state;
      const label = stage.querySelector('[data-run-state]');
      if (label) label.textContent = state.charAt(0).toUpperCase() + state.slice(1);
    });
    lines.forEach((line, index) => line.classList.toggle('is-visible', index < phase));
    checks.forEach((check, index) => check.classList.toggle('is-checked', index < phase));
    if (status) {
      status.dataset.state = phase === 0 ? 'ready' : phase === 5 ? 'passed' : 'running';
      status.textContent = phase === 0 ? 'Ready' : phase === 5 ? 'Passed' : 'Running';
    }
  };

  const play = () => {
    clearTimers();
    board.classList.add('is-armed');
    setPhase(0);
    for (let phase = 1; phase <= 5; phase++) {
      timers.push(window.setTimeout(() => setPhase(phase), 350 + (phase - 1) * 600));
    }
  };

  board.classList.add('is-armed');
  setPhase(0);

  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting) || started) return;
    const activeTab = board.querySelector('[data-system-tab][aria-selected="true"]');
    if (!activeTab || activeTab.dataset.systemTab !== 'run') return;
    started = true;
    observer.disconnect();
    play();
  }, { threshold: 0.25, rootMargin: '0px 0px -10% 0px' });
  observer.observe(board);

  board.addEventListener('system-view', (event) => {
    if (event.detail !== 'run' || started) return;
    started = true;
    observer.disconnect();
    play();
  });

  if (replay) {
    replay.addEventListener('click', () => {
      started = true;
      play();
    });
  }
})();
