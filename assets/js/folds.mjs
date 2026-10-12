/* The decision cards fold on narrow screens so the page does not become eleven
   open panels in a scroll. The first card of each group stays open: a folded list
   with nothing open gives no sign that the rest can be opened. */

/* showcase.css hides .dec-fold until html[data-js] exists, so a reader without
   JS gets open cards instead of a button that does nothing. That flag is set by
   main.js, which this page does not load, so it is set here too. */
document.documentElement.dataset.js = '1';

const narrow = window.matchMedia('(max-width: 760px)');

function setOpen(card, on) {
  const btn = card.querySelector('.dec-fold');
  if (!btn) return;
  if (on) delete card.dataset.fold;
  else card.dataset.fold = 'closed';
  btn.setAttribute('aria-expanded', String(on));
  const label = btn.querySelector('span');
  if (label) label.textContent = on ? 'hide' : 'show';
}

const cards = [...document.querySelectorAll('.dec-card')];
if (cards.length) {
  cards.forEach((card) => setOpen(card, !(narrow.matches && card.previousElementSibling)));
  cards.forEach((card) => {
    const btn = card.querySelector('.dec-fold');
    if (btn) btn.addEventListener('click', () => setOpen(card, card.dataset.fold === 'closed'));
  });
  /* Widening makes the folded state meaningless; the labels have to follow or
     they say "show" under an open card. */
  narrow.addEventListener('change', (e) => {
    if (!e.matches) cards.forEach((card) => setOpen(card, true));
  });
}
