(function () {
  'use strict';

  const video = document.getElementById('release-reel');
  const playButton = document.querySelector('[data-reel-play]');
  const cueButtons = Array.from(document.querySelectorAll('[data-cue]'));
  const cueLabel = document.querySelector('[data-cue-label]');
  const timeLabel = document.querySelector('[data-time]');
  const cueTimes = cueButtons.map((button) => Number(button.dataset.cue));
  const cueNames = cueButtons.map((button) => button.dataset.cueName);
  let starting = false;

  const formatTime = (value) => {
    const seconds = Number.isFinite(value) ? value : 0;
    return seconds.toFixed(2);
  };

  const setActiveCue = (index) => {
    cueButtons.forEach((button, i) => {
      button.classList.toggle('is-active', i === index);
      if (i === index) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
    if (cueLabel && cueNames[index]) cueLabel.textContent = String(index + 1).padStart(2, '0') + ' / ' + cueNames[index];
  };

  const restore = () => {
    if (!video || !playButton) return;
    video.controls = false;
    playButton.hidden = false;
  };

  function startAt(seconds, moveFocus) {
    if (!video || !playButton || starting) return;
    starting = true;
    playButton.hidden = true;
    video.controls = true;
    video.preload = 'auto';

    const seek = () => {
      const limit = Number.isFinite(video.duration) ? Math.max(0, video.duration - 0.05) : seconds;
      try {
        video.currentTime = Math.min(seconds, limit);
      } catch (error) {
        restore();
      }
    };

    if (seconds > 0) {
      if (video.readyState >= 1) seek();
      else video.addEventListener('loadedmetadata', seek, { once: true });
    }

    let attempt;
    try {
      attempt = video.play();
    } catch (error) {
      restore();
      starting = false;
      return;
    }

    if (attempt && typeof attempt.then === 'function') {
      attempt
        .then(() => {
          if (moveFocus) video.focus();
        })
        .catch(() => {
          restore();
          playButton.focus();
        })
        .finally(() => {
          starting = false;
        });
    } else {
      starting = false;
    }
  }

  if (video && playButton) {
    playButton.hidden = false;
    playButton.addEventListener('click', () => startAt(0, true));

    const reelLink = document.querySelector('.reel-link');
    const reelFrame = document.querySelector('.reel-frame');
    if (reelLink && reelFrame) {
      reelLink.addEventListener('click', (event) => {
        event.preventDefault();
        reelFrame.scrollIntoView({ block: 'center' });
        startAt(0, true);
      });
    }

    cueButtons.forEach((button) => {
      button.addEventListener('click', () => startAt(Number(button.dataset.cue), true));
    });

    video.addEventListener('timeupdate', () => {
      const current = video.currentTime || 0;
      let index = 0;
      for (let i = 0; i < cueTimes.length; i++) {
        if (current + 0.08 >= cueTimes[i]) index = i;
      }
      setActiveCue(index);
      if (timeLabel) timeLabel.textContent = formatTime(current);
    });

    video.addEventListener('ended', () => {
      if (timeLabel) timeLabel.textContent = formatTime(video.duration);
      setActiveCue(cueTimes.length - 1);
    });

    video.addEventListener('error', restore);
    setActiveCue(0);
  }

  const menu = document.querySelector('.menu');
  const summary = menu ? menu.querySelector('summary') : null;

  const closeMenu = (restoreFocus) => {
    if (!menu || !menu.open) return;
    menu.open = false;
    if (restoreFocus && summary) summary.focus();
  };

  if (menu) {
    document.addEventListener('click', (event) => {
      if (menu.open && !menu.contains(event.target)) closeMenu(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu(true);
    });
    menu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => closeMenu(false));
    });
  }

  const stages = Array.from(document.querySelectorAll('[data-stage]'));
  const stageLinks = Array.from(document.querySelectorAll('[data-stage-link]'));
  const viewingLabel = document.querySelector('[data-viewing-label]');
  let currentStage = '';

  const setStage = (stage, name) => {
    if (!stage || stage === currentStage) return;
    currentStage = stage;
    document.body.dataset.viewing = stage;
    if (viewingLabel) viewingLabel.textContent = stage + ' / ' + name;
    stageLinks.forEach((link) => {
      if (link.dataset.stageLink === stage) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  };

  const updateStage = () => {
    if (!stages.length) return;
    const marker = window.innerHeight * 0.34;
    let active = stages[0];
    stages.forEach((section) => {
      if (section.getBoundingClientRect().top <= marker) active = section;
    });
    setStage(active.dataset.stage, active.dataset.stageName);
  };

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      updateStage();
      ticking = false;
    });
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  updateStage();

  document.documentElement.classList.add('is-ready');
})();
