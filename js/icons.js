// Icone disegnate a mano (stile tratto arrotondato), colorate con currentColor.
const P = {
  pipi: '<path d="M12 3.5s6 6.4 6 10.8a6 6 0 0 1-12 0C6 9.9 12 3.5 12 3.5z"/><path d="M9.5 14.5a2.6 2.6 0 0 0 2.2 2.4"/>',
  cacca: '<path d="M6 19.5h12a2.5 2.5 0 0 0 0-5H6a2.5 2.5 0 0 0 0 5z"/><path d="M7.5 14.5a2.3 2.3 0 0 1 0-4.6h9a2.3 2.3 0 0 1 0 4.6"/><path d="M9.5 9.9a2.6 2.6 0 0 1 2.6-2.6c1.4 0 1.9-1.2 1.4-2.8 2 .5 3 2.2 2.2 5.4"/>',
  pasti: '<path d="M9.5 3h5v3h-5z"/><path d="M8.5 6h7l1.5 3.5V19a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9.5z"/><path d="M7 12.5h4M7 16h3"/>',
  pisolini: '<path d="M19.5 14.6A7.8 7.8 0 1 1 9.4 4.5a6.2 6.2 0 0 0 10.1 10.1z"/><path d="M15 4h3l-3 3.5h3"/>',
  note: '<path d="M4.5 19.5h4l10-10a2.8 2.8 0 0 0-4-4l-10 10z"/><path d="M13.5 6.5l4 4"/>',
  salute: '<rect x="3.5" y="8" width="17" height="8" rx="4" transform="rotate(-45 12 12)"/><path d="M9.2 9.2l5.6 5.6"/>',
  umore: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14a4.5 4.5 0 0 0 7 0"/><path d="M9 10h.01M15 10h.01"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  peso: '<rect x="3.5" y="5" width="17" height="15" rx="3.5"/><path d="M7.5 11a4.5 4.5 0 0 1 9 0"/><path d="M12 11l1.8-2.2"/>',
  trash: '<path d="M4.5 7h15"/><path d="M9.5 7V4.5h5V7"/><path d="M6.5 7l1 12.5a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4l1-12.5"/><path d="M10 11v6M14 11v6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};
export const icon = (name, cls = 'ic') =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.note}</svg>`;
