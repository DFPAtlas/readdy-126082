// ============================================================================
// Wallboard — office location configuration.
//
// Single source of truth for the office-information strip's location and
// timezone. City-level coordinates only — no precise private business address
// is ever hard-coded into frontend code. Update this one place to move the
// wallboard to another office; nothing else in the strip needs to change.
// ============================================================================

export const WALLBOARD_LOCATION = {
  /** Human-readable office label shown in the information strip. */
  label: 'London',
  /** IANA timezone used for wallboard date/time (Europe/London). */
  timezone: 'Europe/London',
  /** City-level coordinates for the weather source (not a precise address). */
  latitude: 51.5074,
  longitude: -0.1278,
} as const;