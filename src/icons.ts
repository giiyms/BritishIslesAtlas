/** Small stroke icons for chips and controls. */
export function icon(body: string): string {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export const ICONS = {
  layers: icon(
    `<path d="m12 3 9 5-9 5L3 8l9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 16 9 5 9-5"/>`,
  ),
  chevron: icon(`<path d="m6 14 6-6 6 6"/>`),
  search: icon(`<circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.6-3.6"/>`),
  plus: icon(`<path d="M12 5v14M5 12h14"/>`),
  minus: icon(`<path d="M5 12h14"/>`),
  crosshair: icon(
    `<circle cx="12" cy="12" r="6"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>`,
  ),
  roads: icon(
    `<path d="M4 19 8.2 5"/><path d="M15.8 5 20 19"/><path d="M12 6.5v2.2M12 12v2.2M12 17.2V19"/>`,
  ),
  schools: icon(
    `<path d="M3 10 12 4l9 6"/><path d="M5 10.5V20h14v-9.5"/><path d="M10 20v-4.5h4V20"/>`,
  ),
  libraries: icon(
    `<path d="M4 19.5V6.5c0-.8.7-1.5 1.5-1.5H11v14.5H5.5A1.5 1.5 0 0 1 4 19.5z"/><path d="M13 5h5.5c.8 0 1.5.7 1.5 1.5v13c0 .8-.7 1.5-1.5 1.5H13V5z"/><path d="M12 5v14.5"/>`,
  ),
  universities: icon(
    `<path d="M3 10 12 4l9 6"/><path d="M5 10.5V20h14v-9.5"/><path d="M9 20v-5h6v5"/><path d="M12 10.5v2"/>`,
  ),
  museums: icon(
    `<path d="M3 10 12 4l9 6"/><path d="M5 10.5V20h14v-9.5"/><path d="M4 20h16"/><path d="M8 14h2v4H8zM14 14h2v4h-2zM11 12h2v6h-2z"/>`,
  ),
  "railway-stations": icon(
    `<path d="M4 17.5h16"/><rect x="6" y="5" width="12" height="10" rx="1.5"/><path d="M8.5 15v2.5M15.5 15v2.5"/><circle cx="9" cy="18.5" r="1.2"/><circle cx="15" cy="18.5" r="1.2"/><path d="M9 8.5h6M9 11.5h6"/>`,
  ),
  aerodromes: icon(
    `<path d="M12 3.5v4"/><path d="M4.5 12.5 12 9.5l7.5 3"/><path d="M6.5 19.5 12 14.5l5.5 5"/><path d="M12 9.5V19.5"/>`,
  ),
  "ferry-terminals": icon(
    `<path d="M4 18.5h16"/><path d="M6.5 18.5 8 12.5h8l1.5 6"/><path d="M7.5 12.5 12 7l4.5 5.5"/><path d="M12 7V4.5"/><path d="M9.5 15.5h5"/>`,
  ),
  marinas: icon(
    `<path d="M4 19.5h16"/><path d="M6 16.5c2.2-1.8 4.2-2.8 6-2.8s3.8 1 6 2.8"/><path d="M12 4.5v9.2"/><path d="M9.2 7.2 12 4.5l2.8 2.7"/><circle cx="12" cy="14.2" r="1.3"/>`,
  ),
  zoos: icon(
    `<circle cx="9" cy="11" r="3"/><circle cx="15.5" cy="12.5" r="2.4"/><path d="M7.2 9.2 6 6.5M10.8 9.2 12 6.5"/><path d="M14.2 10.8 13.2 8.2M16.8 10.8 17.8 8.2"/><path d="M5 19.5c1.2-3.2 2.8-4.5 4-4.5s2.8 1.3 4 4.5"/><path d="M12.5 19.5c.8-2.4 1.8-3.4 3-3.4s2.2 1 3 3.4"/>`,
  ),
  theatres: icon(
    `<path d="M4 19.5h16"/><path d="M6 17V9.5l6-4.5 6 4.5V17"/><path d="M9 17v-3.5h6V17"/><path d="M8.5 11.5h7"/><circle cx="12" cy="7.2" r="1.1"/>`,
  ),
  battlefields: icon(
    `<path d="M6.5 20.5 12 4.5l5.5 16"/><path d="M8.2 14.5h7.6"/><path d="M12 4.5V3"/><circle cx="12" cy="18.5" r="1.2"/>`,
  ),
  cinemas: icon(
    `<rect x="3.5" y="6" width="17" height="12" rx="1.5"/><path d="M7 9.5h2.5M7 12h3.5M7 14.5h2.5"/><circle cx="15.5" cy="12" r="2.2"/><path d="M14.2 12h2.6"/>`,
  ),
  stadiums: icon(
    `<path d="M4 18.5c2.5-2 5-3 8-3s5.5 1 8 3"/><path d="M5.5 15.5c2-1.4 4.2-2.1 6.5-2.1s4.5.7 6.5 2.1"/><path d="M7 12.5c1.5-.9 3.2-1.4 5-1.4s3.5.5 5 1.4"/><path d="M8.5 9.8c1-.6 2.2-.9 3.5-.9s2.5.3 3.5.9"/><path d="M12 4.5v4.4"/><path d="M9.5 6.2 12 4.5l2.5 1.7"/>`,
  ),
  "theme-parks": icon(
    `<path d="M4 19.5h16"/><path d="M6.5 19.5V11l5.5-5.5L17.5 11v8.5"/><circle cx="12" cy="13.5" r="2.2"/><path d="M12 5.5V3.5"/><path d="M9.5 7.2 12 5.5l2.5 1.7"/>`,
  ),
  viewpoints: icon(
    `<circle cx="12" cy="12" r="3.2"/><path d="M12 3.5v3.2M12 17.3v3.2M3.5 12h3.2M17.3 12h3.2"/><path d="m6.2 6.2 2.2 2.2M15.6 15.6l2.2 2.2M17.8 6.2l-2.2 2.2M8.4 15.6l-2.2 2.2"/>`,
  ),
  "arts-centres": icon(
    `<path d="M4 19.5h16"/><path d="M6 17V9.5l6-4.5 6 4.5V17"/><path d="M9 12.5h6"/><path d="M9 15h6"/><circle cx="12" cy="7.2" r="1.1"/>`,
  ),
  aquariums: icon(
    `<path d="M4 16.5c2.2-3.5 5-5.2 8-5.2s5.8 1.7 8 5.2"/><path d="M5.5 12.2c1.8-2.2 4-3.3 6.5-3.3s4.7 1.1 6.5 3.3"/><circle cx="9.2" cy="10.5" r="1.1"/><circle cx="14.8" cy="11.2" r="0.85"/><path d="M12 7.5c0-1.6.7-2.8 1.6-3.2"/>`,
  ),
  piers: icon(
    `<path d="M4 19.5h16"/><path d="M6 16.5V9.5h12v7"/><path d="M8 9.5V6.5M12 9.5V5.5M16 9.5V6.5"/><path d="M7 12.5h10"/><path d="M7 15h10"/>`,
  ),
  ruins: icon(
    `<path d="M4 19.5h16"/><path d="M5.5 19.5V11.5L8 8.5l2.5 2V19.5"/><path d="M10.5 19.5V10l3.5-4 4 3.5v10"/><path d="M8 14.5h2.5M14 13.5h3"/>`,
  ),
  "golf-courses": icon(
    `<circle cx="12" cy="17.5" r="2.2"/><path d="M12 15.3V5.5"/><path d="M12 5.5c3.2 0 5.5 1.4 5.5 3.2S15.2 12 12 12"/><path d="M12 5.5c-1.2.4-2 1.2-2 2.2"/>`,
  ),
  galleries: icon(
    `<rect x="3.5" y="5.5" width="17" height="13" rx="1.4"/><path d="M7 14.5 9.5 10l2.2 3.2L14.5 9l2.5 5.5"/><circle cx="8.2" cy="8.2" r="1.1"/>`,
  ),
  marketplaces: icon(
    `<path d="M4 19.5h16"/><path d="M5.5 16.5V9.5h13v7"/><path d="M5.5 9.5 12 5.5l6.5 4"/><path d="M8 12.5h2.5M13.5 12.5H16"/><path d="M8 15h2.5M13.5 15H16"/>`,
  ),
  "nature-reserves": icon(
    `<path d="M4 19.5h16"/><path d="M6 19.5c1.5-4 3.5-7.5 6-10.5 2.5 3 4.5 6.5 6 10.5"/><path d="M9 14.5c1.2-1.8 2.2-2.8 3-3.5 0.8 0.7 1.8 1.7 3 3.5"/><circle cx="12" cy="8" r="1.2"/>`,
  ),
  "camp-sites": icon(
    `<path d="M4 19.5h16"/><path d="M6 19.5 12 6.5l6 13"/><path d="M8.5 14.5h7"/><path d="M12 6.5v-2"/>`,
  ),
  constituencies: icon(
    `<path d="M4 6.5h7.5V4.5H4z"/><path d="M12.5 6.5H20V4.5h-7.5z"/><path d="M4 13.5h7.5V8H4z"/><path d="M12.5 13.5H20V8h-7.5z"/><path d="M4 19.5h7.5v-5H4z"/><path d="M12.5 19.5H20v-5h-7.5z"/>`,
  ),
  memorials: icon(
    `<path d="M4 19.5h16"/><path d="M7.5 19.5V10.5h9v9"/><path d="M9.5 10.5V7.5L12 5l2.5 2.5v3"/><circle cx="12" cy="14.5" r="1.6"/><path d="M12 12.9v3.2"/>`,
  ),
  "sports-centres": icon(
    `<rect x="4" y="10.5" width="16" height="9" rx="1.2"/><path d="M7 10.5V8.5h10v2"/><circle cx="12" cy="15" r="2.2"/><path d="M12 12.8v4.4M9.8 15h4.4"/>`,
  ),
  "caravan-sites": icon(
    `<path d="M4 19.5h16"/><rect x="5" y="10.5" width="14" height="7" rx="1.2"/><path d="M7 10.5V8.5h10v2"/><circle cx="8.5" cy="18.2" r="1.3"/><circle cx="15.5" cy="18.2" r="1.3"/>`,
  ),
  "fitness-centres": icon(
    `<rect x="5" y="8.5" width="14" height="11" rx="1.2"/><path d="M8 8.5V6.5h8v2"/><path d="M9.5 14.5c0-1.4 1.1-2.5 2.5-2.5s2.5 1.1 2.5 2.5"/><path d="M8.5 17.5h7"/><circle cx="12" cy="12.2" r="1.2"/>`,
  ),
  "community-centres": icon(
    `<path d="M4 19.5h16"/><path d="M6 17V9.5l6-4.5 6 4.5V17"/><path d="M9.5 12.5h5"/><path d="M9.5 15h5"/><path d="M11 17v-2.5h2V17"/>`,
  ),
  playgrounds: icon(
    `<path d="M4 19.5h16"/><path d="M6 17.5V12l6-5.5 6 5.5v5.5"/><circle cx="9" cy="14.5" r="1.4"/><circle cx="15" cy="14.5" r="1.4"/><path d="M12 11.5v6"/><path d="M9.5 17.5h5"/>`,
  ),
  beaches: icon(
    `<circle cx="16.2" cy="6.4" r="2.1"/><path d="M16.2 2.8v1"/><path d="M19.6 4.2l-.8.6"/><path d="M19.2 7.6l-.7-.4"/><path d="M3.2 14.6c1.7-1.5 3.2-1.5 4.9 0s3.2 1.5 4.9 0 3.2-1.5 4.9 0 2.6 1.5 2.9.9"/><path d="M3.2 18.4c1.7-1.5 3.2-1.5 4.9 0s3.2 1.5 4.9 0 3.2-1.5 4.9 0"/>`,
  ),
  "swimming-pools": icon(
    `<rect x="3.5" y="6.5" width="17" height="11" rx="2"/><path d="M6.2 10.4c1.1.8 2 .8 3.1 0s2-.8 3.1 0 2 .8 3.1 0 1.7.8 2.3.5"/><path d="M6.2 14.2c1.1.8 2 .8 3.1 0s2-.8 3.1 0 2 .8 3.1 0"/>`,
  ),
  churches: icon(
    `<path d="M12 3v3M10.2 4.6h3.6"/><path d="M6 21V11.2L12 7l6 4.2V21"/><path d="M10 21v-4h4v4"/><path d="M4 21h16"/>`,
  ),
  mosques: icon(
    `<path d="M4 20V12a8 8 0 0 1 16 0v8"/><path d="M4 20h16"/><path d="M12 4V2.2"/><path d="M8.5 20v-2.5a3.5 3.5 0 0 1 7 0V20"/>`,
  ),
  religious: icon(
    `<path d="M4 20V9.5L12 4l8 5.5V20"/><path d="M4 20h16"/><path d="M9.5 20v-5h5v5"/>`,
  ),
  pubs: icon(
    `<path d="M5 8h9.5v7.2A3.2 3.2 0 0 1 11.3 18.4H8.2A3.2 3.2 0 0 1 5 15.2V8z"/><path d="M14.5 9.2h2.2a2.2 2.2 0 1 1 0 4.4H14.5"/><path d="M7.2 5.2c.6 1.1 1.8 1.1 2.4 0M10.2 5.2c.5 1 1.5 1 2 0"/>`,
  ),
  hospitals: icon(`<path d="M12 4.5v15M4.5 12h15"/>`),
  "fire-stations": icon(
    `<path d="M5 20.5V10l7-5.5 7 5.5v10.5"/><path d="M5 20.5h14"/><path d="M10 20.5v-5h4v5"/><path d="M12 6.5v3"/>`
  ),
  police: icon(
    `<path d="M12 3.2 5 6.2v5.6c0 4.2 2.8 7 7 8.6 4.2-1.6 7-4.4 7-8.6V6.2L12 3.2z"/><path d="M9.5 12.2h5M12 9.7v5"/>`
  ),
  post: icon(
    `<rect x="3.5" y="6" width="17" height="12" rx="1.6"/><path d="m4 8 8 5.5L20 8"/>`,
  ),
  population: icon(
    `<circle cx="9" cy="8" r="2.6"/><path d="M3.4 19c.5-2.8 2.5-4.2 5.6-4.2s5.1 1.4 5.6 4.2"/><circle cx="17" cy="9" r="2"/><path d="M16 14.6c1.8.2 3.2 1.3 3.8 3.6"/>`,
  ),
  census: icon(
    `<rect x="5" y="3.5" width="14" height="17" rx="1.8"/><path d="M8 8.5h8M8 12h8M8 15.5h5"/>`,
  ),
  petrol: icon(
    `<path d="M5 20V7.2A1.8 1.8 0 0 1 6.8 5.4h6.2A1.8 1.8 0 0 1 14.8 7.2V20"/><path d="M5 20h9.8"/><path d="M14.8 10h1.6l2.6 2v4.2a1.6 1.6 0 1 1-3.2 0"/><path d="M7.4 9h4"/>`,
  ),
  ev: icon(`<path d="M13 2.5 4.5 13.5H11l-1 8 9-11.2h-6.4L13 2.5z"/>`),
  cemeteries: icon(
    `<path d="M12 3.5v6M9.2 6.5h5.6"/><path d="M5.5 20.5c.8-5.2 2.8-8 6.5-8s5.7 2.8 6.5 8"/>`,
  ),
  immigration: icon(
    `<rect x="4.5" y="3.5" width="15" height="17" rx="1.8"/><circle cx="12" cy="11" r="2.6"/><path d="M8 17.2h8"/>`,
  ),
  crime: icon(`<path d="M12 3.2 5 6.2v5.6c0 4.2 2.8 7 7 8.6 4.2-1.6 7-4.4 7-8.6V6.2L12 3.2z"/>`),
  health: icon(`<path d="M3 12h4.2l2.1-5 3.8 10 2.2-5H21"/>`),
  weather: icon(
    `<path d="M7 18h9.5a3.8 3.8 0 0 0 .5-7.6 5.2 5.2 0 0 0-10 .9A3.3 3.3 0 0 0 7 18z"/>`,
  ),
  power: icon(
    `<path d="M9 3.5v5.2M15 3.5v5.2"/><path d="M7.2 8.7h9.6v2.6a4.8 4.8 0 0 1-9.6 0V8.7z"/><path d="M12 16.2V20.5"/>`,
  ),
  wind: icon(
    `<path d="M3 8h10.5a2.8 2.8 0 1 0-2.8-2.8"/><path d="M3 12h14a2.8 2.8 0 1 1-2.8 2.8"/><path d="M3 16h7.5a2.3 2.3 0 1 1-2.3 2.3"/>`,
  ),
  nuclear: icon(
    `<circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><ellipse cx="12" cy="12" rx="8.5" ry="3.3"/><ellipse cx="12" cy="12" rx="8.5" ry="3.3" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="8.5" ry="3.3" transform="rotate(120 12 12)"/>`,
  ),
  castles: icon(
    `<path d="M4 20.5V10.5l2.6-1.6v2.2L12 7l5.4 4.1V8.9l2.6 1.6v10"/><path d="M4 20.5h16"/><path d="M10 20.5v-4h4v4"/>`,
  ),
  historic: icon(
    `<path d="M4 20h16"/><path d="M6 20V9.5M10 20V9.5M14 20V9.5M18 20V9.5"/><path d="M4.5 9.5h15"/><path d="M6.2 9.5 8.2 5h7.6l2 4.5"/>`,
  ),
  legends: icon(
    `<path d="M7 4.5h10.2a2 2 0 0 1 0 4H7"/><path d="M7 8.5V18a2 2 0 0 0 2 2h8.2V8.5"/><path d="M7 4.5a2 2 0 0 0 0 4"/>`,
  ),
  mountains: icon(`<path d="M3 19.5 9.2 8l3.1 4.6L15.2 6.5 21 19.5H3z"/>`),
} as const;
