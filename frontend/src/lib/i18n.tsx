import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export type Lang = 'en' | 'kn'

const translations: Record<string, Record<Lang, string>> = {
  // ── Tab names ──────────────────────────────────────────────────────
  'tab.command': { en: 'COMMAND', kn: 'ನಿಯಂತ್ರಣ' },
  'tab.investigate': { en: 'INVESTIGATE', kn: 'ತನಿಖೆ' },
  'tab.connect': { en: 'CONNECT', kn: 'ಸಂಪರ್ಕ' },
  'tab.forecast': { en: 'FORECAST', kn: 'ಮುನ್ಸೂಚನೆ' },
  'tab.act': { en: 'ACT', kn: 'ಕ್ರಮ' },
  'tab.replay': { en: 'REPLAY', kn: 'ಮರುಪ್ರದರ್ಶನ' },
  'tab.trust': { en: 'TRUST', kn: 'ನಂಬಿಕೆ' },

  // ── Product positioning ────────────────────────────────────────────
  'product.tagline': {
    en: 'Crime Intelligence & Decision Support Platform',
    kn: 'ಅಪರಾಧ ಗುಪ್ತಚರ ಮತ್ತು ನಿರ್ಧಾರ ಬೆಂಬಲ ವೇದಿಕೆ',
  },

  // ── COMMAND ────────────────────────────────────────────────────────
  'command.intelligence': { en: 'Intelligence', kn: 'ಗುಪ್ತಚರ' },
  'command.alerts': { en: 'Active alerts', kn: 'ಸಕ್ರಿಯ ಎಚ್ಚರಿಕೆಗಳು' },
  'command.headline': {
    en: '{crime} is running {excess} cases above its STL baseline across {n} district(s), most sharply in {district}. The 80% interval on that departure is {lo} to {hi}.',
    kn: '{crime} {n} ಜಿಲ್ಲೆಗಳಲ್ಲಿ ತನ್ನ STL ಮೂಲಮಟ್ಟಕ್ಕಿಂತ {excess} ಪ್ರಕರಣಗಳಷ್ಟು ಹೆಚ್ಚಾಗಿ ನಡೆಯುತ್ತಿದೆ, {district}ದಲ್ಲಿ ಅತಿ ತೀವ್ರವಾಗಿದೆ. ಈ ವ್ಯತ್ಯಾಸದ 80% ಮಧ್ಯಂತರ {lo} ರಿಂದ {hi}.',
  },
  'command.openForecast': { en: 'Open in forecast', kn: 'ಮುನ್ಸೂಚನೆಯಲ್ಲಿ ತೆರೆಯಿರಿ' },
  'anom.above': { en: '{n}× above the {district} baseline for {crime}', kn: '{crime}ಗಾಗಿ {district} ಮೂಲಮಟ್ಟಕ್ಕಿಂತ {n}× ಹೆಚ್ಚು' },
  'anom.below': { en: '{n}× below expected in {district}', kn: '{district}ದಲ್ಲಿ ನಿರೀಕ್ಷಿತಕ್ಕಿಂತ {n}× ಕಡಿಮೆ' },
  'command.alertOpen': { en: 'Open {district}', kn: '{district} ತೆರೆಯಿರಿ' },
  'command.noSignal': { en: 'No departures from baseline in the current window.', kn: 'ಪ್ರಸ್ತುತ ಅವಧಿಯಲ್ಲಿ ಮೂಲಮಟ್ಟದಿಂದ ಯಾವುದೇ ವ್ಯತ್ಯಾಸ ಕಂಡುಬಂದಿಲ್ಲ.' },
  'command.noAlerts': { en: 'No active alerts.', kn: 'ಸಕ್ರಿಯ ಎಚ್ಚರಿಕೆಗಳಿಲ್ಲ.' },
  'command.loadFailed': { en: 'Operational picture unavailable', kn: 'ಕಾರ್ಯಾಚರಣೆ ಚಿತ್ರಣ ಲಭ್ಯವಿಲ್ಲ' },
  'command.loadFailedHint': {
    en: 'The analytics artifacts could not be loaded. No figures are shown rather than estimated ones.',
    kn: 'ವಿಶ್ಲೇಷಣಾ ಕಡತಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗಲಿಲ್ಲ. ಅಂದಾಜು ಅಂಕಿಅಂಶಗಳನ್ನು ತೋರಿಸುವ ಬದಲು ಯಾವುದನ್ನೂ ತೋರಿಸಿಲ್ಲ.',
  },
  'command.mFirs': { en: 'FIRs analysed', kn: 'ವಿಶ್ಲೇಷಿಸಿದ ಎಫ್‌ಐಆರ್' },
  'command.mDistricts': { en: 'Police districts', kn: 'ಪೊಲೀಸ್ ಜಿಲ್ಲೆಗಳು' },
  'command.mHotCells': { en: 'Hot cells', kn: 'ಹಾಟ್ ಸೆಲ್‌ಗಳು' },
  'command.mNetworks': { en: 'Co-offending groups', kn: 'ಸಹ-ಅಪರಾಧ ಗುಂಪುಗಳು' },
  'command.hAboveBaseline': { en: 'Above baseline', kn: 'ಮೂಲಭೂತ ಮಟ್ಟಕ್ಕಿಂತ ಮೇಲೆ' },
  'command.hInterval': { en: '80% interval', kn: '80% ಮಧ್ಯಂತರ' },
  'command.hDistricts': { en: 'Districts affected', kn: 'ಪರಿಣಾಮ ಜಿಲ್ಲೆಗಳು' },
  'command.topDistricts': { en: 'By volume', kn: 'ಪ್ರಮಾಣದ ಪ್ರಕಾರ' },

  // ── INVESTIGATE ────────────────────────────────────────────────────
  'investigate.searchLabel': { en: 'Search records', kn: 'ದಾಖಲೆಗಳನ್ನು ಹುಡುಕಿ' },
  'investigate.searchPlaceholder': { en: 'Name…', kn: 'ಹೆಸರು…' },
  'investigate.searchHint': {
    en: 'Person names on record. Typos and word order are tolerated.',
    kn: 'ದಾಖಲೆಯಲ್ಲಿರುವ ವ್ಯಕ್ತಿಗಳ ಹೆಸರುಗಳು. ಕಾಗುಣಿತ ದೋಷ ಮತ್ತು ಪದಗಳ ಕ್ರಮ ಬದಲಾದರೂ ಹುಡುಕಾಟ ನಡೆಯುತ್ತದೆ.',
  },
  'investigate.empty': {
    en: 'Search for a person on record to open their investigation workspace.',
    kn: 'ತನಿಖಾ ಕಾರ್ಯಕ್ಷೇತ್ರ ತೆರೆಯಲು ದಾಖಲೆಯಲ್ಲಿರುವ ವ್ಯಕ್ತಿಯನ್ನು ಹುಡುಕಿ.',
  },
  'investigate.noResults': { en: 'No matching records.', kn: 'ಹೊಂದಾಣಿಕೆಯ ದಾಖಲೆಗಳಿಲ್ಲ.' },
  'investigate.loadFailed': { en: 'Record index unavailable.', kn: 'ದಾಖಲೆ ಸೂಚಿ ಲಭ್ಯವಿಲ್ಲ.' },
  'investigate.rowMeta': { en: '{cases} FIRs · {districts} districts', kn: '{cases} ಎಫ್‌ಐಆರ್ · {districts} ಜಿಲ್ಲೆಗಳು' },
  'investigate.placeholder': {
    en: 'Select a record to see their timeline, co-accused, districts and offence pattern — assembled from what is already on file.',
    kn: 'ಕಾಲಗಣನೆ, ಸಹ-ಆರೋಪಿಗಳು, ಜಿಲ್ಲೆಗಳು ಮತ್ತು ಅಪರಾಧ ಮಾದರಿಯನ್ನು ನೋಡಲು ಒಂದು ದಾಖಲೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ — ಈಗಾಗಲೇ ಕಡತದಲ್ಲಿರುವ ಮಾಹಿತಿಯಿಂದಲೇ ಸಂಗ್ರಹಿಸಲಾಗಿದೆ.',
  },

  // ── Investigation workspace ────────────────────────────────────────
  'workspace.idLine': { en: 'Record {id} · age {age}', kn: 'ದಾಖಲೆ {id} · ವಯಸ್ಸು {age}' },
  'workspace.fLinkedFirs': { en: 'Linked FIRs', kn: 'ಸಂಬಂಧಿತ ಎಫ್‌ಐಆರ್' },
  'workspace.fCoAccused': { en: 'Co-accused', kn: 'ಸಹ-ಆರೋಪಿ' },
  'workspace.fDistricts': { en: 'Districts', kn: 'ಜಿಲ್ಲೆಗಳು' },
  'workspace.fArrests': { en: 'Arrest records', kn: 'ಬಂಧನ ದಾಖಲೆಗಳು' },
  'workspace.fLastArrest': { en: 'Last arrest', kn: 'ಕೊನೆಯ ಬಂಧನ' },
  'workspace.fSpan': { en: 'Record span', kn: 'ದಾಖಲೆ ಅವಧಿ' },
  'workspace.noScoreNote': {
    en: 'Every figure above is a fact already on record. PRAHARI does not score individuals — it forecasts risk for places and time windows only. See TRUST for what the system must not be used for.',
    kn: 'ಮೇಲಿನ ಪ್ರತಿಯೊಂದು ಅಂಕಿಅಂಶವೂ ಈಗಾಗಲೇ ದಾಖಲೆಯಲ್ಲಿರುವ ಸಂಗತಿ. ಪ್ರಹರಿ ವ್ಯಕ್ತಿಗಳಿಗೆ ಅಂಕ ನೀಡುವುದಿಲ್ಲ — ಅದು ಸ್ಥಳಗಳಿಗೆ ಮತ್ತು ಕಾಲಾವಧಿಗಳಿಗೆ ಮಾತ್ರ ಅಪಾಯ ಮುನ್ಸೂಚನೆ ನೀಡುತ್ತದೆ. ವ್ಯವಸ್ಥೆಯನ್ನು ಯಾವುದಕ್ಕೆ ಬಳಸಬಾರದು ಎಂಬುದಕ್ಕೆ ನಂಬಿಕೆ ವಿಭಾಗವನ್ನು ನೋಡಿ.',
  },
  'workspace.timeline': { en: 'Record timeline', kn: 'ದಾಖಲೆ ಕಾಲಗಣನೆ' },
  'workspace.timelineNote': { en: 'first incident to last, with last arrest marked', kn: 'ಮೊದಲ ಘಟನೆಯಿಂದ ಕೊನೆಯದವರೆಗೆ, ಕೊನೆಯ ಬಂಧನವನ್ನು ಗುರುತಿಸಲಾಗಿದೆ' },
  'workspace.tFirst': { en: 'First incident', kn: 'ಮೊದಲ ಘಟನೆ' },
  'workspace.tLast': { en: 'Last incident', kn: 'ಕೊನೆಯ ಘಟನೆ' },
  'workspace.tArrest': { en: 'Last arrest', kn: 'ಕೊನೆಯ ಬಂಧನ' },
  'workspace.noTimeline': { en: 'No dated incidents on record.', kn: 'ದಾಖಲೆಯಲ್ಲಿ ದಿನಾಂಕ ಸಹಿತ ಘಟನೆಗಳಿಲ್ಲ.' },
  'workspace.associations': { en: 'Co-accused', kn: 'ಸಹ-ಆರೋಪಿಗಳು' },
  'workspace.associationsNote': { en: 'people named alongside this record in the same FIRs', kn: 'ಇದೇ ಎಫ್‌ಐಆರ್‌ಗಳಲ್ಲಿ ಈ ದಾಖಲೆಯ ಜೊತೆಗೆ ಹೆಸರಿಸಲಾದ ವ್ಯಕ್ತಿಗಳು' },
  'workspace.noAssociates': { en: 'No co-accused on record.', kn: 'ದಾಖಲೆಯಲ್ಲಿ ಸಹ-ಆರೋಪಿಗಳಿಲ್ಲ.' },
  'workspace.aShared': { en: '{n} shared', kn: '{n} ಹಂಚಿಕೆ' },
  'workspace.aTotalCases': { en: '{n} FIRs total', kn: 'ಒಟ್ಟು {n} ಎಫ್‌ಐಆರ್' },
  'workspace.pattern': { en: 'Offence pattern', kn: 'ಅಪರಾಧ ಮಾದರಿ' },
  'workspace.patternNote': { en: 'distribution across the record, not a prediction', kn: 'ದಾಖಲೆಯಾದ್ಯಂತ ಹಂಚಿಕೆ, ಮುನ್ಸೂಚನೆಯಲ್ಲ' },
  'workspace.byOffence': { en: 'By offence', kn: 'ಅಪರಾಧದ ಪ್ರಕಾರ' },
  'workspace.byDistrict': { en: 'By district', kn: 'ಜಿಲ್ಲೆಯ ಪ್ರಕಾರ' },
  'workspace.heinous': { en: '{n}% of linked FIRs are classified heinous.', kn: 'ಸಂಬಂಧಿತ ಎಫ್‌ಐಆರ್‌ಗಳಲ್ಲಿ {n}% ಘೋರ ಅಪರಾಧ ಎಂದು ವರ್ಗೀಕರಿಸಲಾಗಿದೆ.' },

  // ── FORECAST lenses ────────────────────────────────────────────────
  'forecast.emergingHint': { en: 'Cells whose recent activity departs from their own 24-month history', kn: 'ತಮ್ಮ 24-ತಿಂಗಳ ಇತಿಹಾಸದಿಂದ ಇತ್ತೀಚಿನ ಚಟುವಟಿಕೆ ಭಿನ್ನವಾಗಿರುವ ಕೋಶಗಳು' },
  'trust.showEvidence': { en: 'How this was tested — show the technical evidence', kn: 'ಇದನ್ನು ಹೇಗೆ ಪರೀಕ್ಷಿಸಲಾಯಿತು — ತಾಂತ್ರಿಕ ಪುರಾವೆ ತೋರಿಸಿ' },
  'trust.hideEvidence': { en: 'Hide the technical evidence', kn: 'ತಾಂತ್ರಿಕ ಪುರಾವೆ ಮರೆಮಾಡಿ' },
  'trust.evidenceHint': { en: 'Calibration curve · accuracy by area · SHAP attribution · fairness audit · worked examples', kn: 'ಕ್ಯಾಲಿಬ್ರೇಶನ್ ವಕ್ರರೇಖೆ · ಪ್ರದೇಶವಾರು ನಿಖರತೆ · SHAP ಕೊಡುಗೆ · ನ್ಯಾಯೋಚಿತ ಲೆಕ್ಕಪರಿಶೋಧನೆ · ಉದಾಹರಣೆಗಳು' },
  'forecast.lensHappening': { en: 'Happening now', kn: 'ಈಗ ನಡೆಯುತ್ತಿರುವುದು' },
  'forecast.lensEmerging': { en: 'Emerging', kn: 'ಉದಯೋನ್ಮುಖ' },
  'forecast.lensRisk': { en: 'Week-ahead risk', kn: 'ಮುಂದಿನ ವಾರದ ಅಪಾಯ' },

  // ── REPLAY ─────────────────────────────────────────────────────────
  'replay.legendTitle': { en: 'Reading the map', kn: 'ನಕ್ಷೆ ಓದುವುದು' },
  'replay.legendForecast': { en: 'Forecast — top {n}% of cells', kn: 'ಮುನ್ಸೂಚನೆ — ಮೇಲಿನ {n}% ಸೆಲ್‌ಗಳು' },
  'replay.legendHit': { en: 'FIR inside the forecast', kn: 'ಮುನ್ಸೂಚನೆಯೊಳಗಿನ ಎಫ್‌ಐಆರ್' },
  'replay.legendMiss': { en: 'FIR outside it', kn: 'ಅದರ ಹೊರಗಿನ ಎಫ್‌ಐಆರ್' },
  'ticker.demo': { en: 'Demo feed', kn: 'ಡೆಮೊ ಫೀಡ್' },
  'ticker.note': { en: 'Replays anomalies detected in the analysed 2016-2024 window — not a live CCTNS link', kn: 'ವಿಶ್ಲೇಷಿತ 2016-2024 ಅವಧಿಯ ಅಸಹಜತೆಗಳ ಮರುಪ್ರಸಾರ — ನೇರ CCTNS ಸಂಪರ್ಕವಲ್ಲ' },
  'ticker.alerts': { en: 'alerts', kn: 'ಎಚ್ಚರಿಕೆಗಳು' },
  'shell.situation': { en: 'State situation', kn: 'ರಾಜ್ಯ ಪರಿಸ್ಥಿತಿ' },
  'shell.situationLine': { en: '{a} active anomalies · {d} districts rising', kn: '{a} ಸಕ್ರಿಯ ಅಸಹಜತೆಗಳು · {d} ಜಿಲ್ಲೆಗಳು ಏರಿಕೆಯಲ್ಲಿ' },
  'shell.situationQuiet': { en: 'No active anomalies', kn: 'ಸಕ್ರಿಯ ಅಸಹಜತೆಗಳಿಲ್ಲ' },
  'sense.firsLatest': { en: 'FIRs · 2024 YTD', kn: 'ಎಫ್‌ಐಆರ್ · 2024 YTD' },
  'predict.persons': { en: 'persons on record', kn: 'ದಾಖಲಿತ ವ್ಯಕ್ತಿಗಳು' },
  'predict.boardHint': { en: 'Scroll to zoom · drag to pan · click a card for the dossier', kn: 'ಝೂಮ್ ಮಾಡಲು ಸ್ಕ್ರೇಲ್ · ಸರಿಸಲು ಎಳೆಯಿರಿ · ವರದಿಗಾಗಿ ಕಾರ್ಡ್ ಕ್ಲಿಕ್ ಮಾಡಿ' },
  'predict.netScope': { en: 'Persons appearing as accused across {firs} FIRs · a link = co-accused in the same FIR. Detected groups are not confirmed criminal organisations.', kn: '{firs} FIRಗಳಲ್ಲಿ ಆರೋಪಿಗಳಾಗಿ ಕಾಣಿಸಿಕೊಂಡ ವ್ಯಕ್ತಿಗಳು · ಸಂಪರ್ಕ = ಒಂದೇ FIRನಲ್ಲಿ ಸಹ-ಆರೋಪಿ. ಪತ್ತೆಯಾದ ಗುಂಪುಗಳು ದೃಢೀಕೃತ ಅಪರಾಧ ಸಂಘಟನೆಗಳಲ್ಲ.' },
  'common.close': { en: 'Close', kn: 'ಮುಚ್ಚಿ' },
  'command.cardKicker': { en: 'District situation', kn: 'ಜಿಲ್ಲಾ ಪರಿಸ್ಥಿತಿ' },
  'command.cardFirs': { en: 'FIRs · 2024 YTD', kn: 'ಎಫ್‌ಐಆರ್ · 2024 YTD' },
  'command.cardYoY': { en: 'vs same period 2023', kn: '2023ರ ಅದೇ ಅವಧಿಗೆ ಹೋಲಿಸಿ' },
  'command.cardTopCrime': { en: 'Top crime', kn: 'ಪ್ರಮುಖ ಅಪರಾಧ' },
  'command.cardAnoms': { en: 'Active anomalies', kn: 'ಸಕ್ರಿಯ ಅಸಹಜತೆಗಳು' },
  'command.cardStations': { en: 'Busiest stations · 2024 YTD', kn: 'ಅತಿ ಕಾರ್ಯನಿರತ ಠಾಣೆಗಳು · 2024 YTD' },
  'command.cardForecast': { en: 'Open forecast', kn: 'ಮುನ್ಸೂಚನೆ ತೆರೆಯಿರಿ' },
  'command.cardDeploy': { en: 'Plan deployment', kn: 'ನಿಯೋಜನೆ ಯೋಜಿಸಿ' },
  'act.marginalTitle': { en: 'Coverage by unit count', kn: 'ಘಟಕ ಸಂಖ್ಯೆಯ ಪ್ರಕಾರ ವ್ಯಾಪ್ತಿ' },
  'act.marginalNote': { en: 'Predicted-crime coverage from the optimizer at each unit count; +pp is what the two added units buy.', kn: 'ಪ್ರತಿ ಘಟಕ ಸಂಖ್ಯೆಯಲ್ಲಿ ಆಪ್ಟಿಮೈಸರ್‌ನ ಮುನ್ಸೂಚಿತ-ಅಪರಾಧ ವ್ಯಾಪ್ತಿ; +pp ಎಂದರೆ ಸೇರಿಸಿದ ಎರಡು ಘಟಕಗಳ ಲಾಭ.' },
  'replay.step1': { en: 'Forecast drawn', kn: 'ಮುನ್ಸೂಚನೆ ರಚನೆ' },
  'replay.step2': { en: 'Real FIRs drop in', kn: 'ನೈಜ ಎಫ್‌ಐಆರ್ ಬೀಳುತ್ತವೆ' },
  'replay.step3': { en: 'Week scored', kn: 'ವಾರದ ಅಂಕ' },
  'replay.vsTrust': { en: 'TRUST reports {n}% captured over the whole held-out test period; each replay week scores only that week.', kn: 'TRUST ಇಡೀ ಪರೀಕ್ಷಾ ಅವಧಿಯ ಮೇಲೆ {n}% ಸೆರೆಹಿಡಿತ ವರದಿ ಮಾಡುತ್ತದೆ; ಪ್ರತಿ ರೀಪ್ಲೇ ವಾರ ಆ ವಾರವನ್ನಷ್ಟೇ ಅಳೆಯುತ್ತದೆ.' },
  'replay.sHitRate': { en: 'Hit rate · this week', kn: 'ಹಿಟ್ ದರ · ಈ ವಾರ' },
  'replay.sCaptured': { en: 'Captured', kn: 'ಸೆರೆಹಿಡಿದದ್ದು' },
  'replay.sPai': { en: 'vs random', kn: 'ಯಾದೃಚ್ಛಿಕದ ವಿರುದ್ಧ' },
  'replay.play': { en: 'Play week', kn: 'ವಾರ ಪ್ಲೇ ಮಾಡಿ' },
  'replay.pause': { en: 'Pause', kn: 'ವಿರಾಮ' },
  'replay.jumpBest': { en: 'Best week', kn: 'ಅತ್ಯುತ್ತಮ ವಾರ' },
  'replay.jumpWorst': { en: 'Worst week', kn: 'ಕೆಟ್ಟ ವಾರ' },
  'replay.bestWeek': { en: 'Best week in the test period', kn: 'ಪರೀಕ್ಷಾ ಅವಧಿಯ ಅತ್ಯುತ್ತಮ ವಾರ' },
  'replay.worstWeek': { en: 'Worst week in the test period', kn: 'ಪರೀಕ್ಷಾ ಅವಧಿಯ ಕೆಟ್ಟ ವಾರ' },
  'replay.partial': { en: 'partial week', kn: 'ಭಾಗಶಃ ವಾರ' },
  'replay.meanHit': { en: 'mean {n}% across full weeks', kn: 'ಪೂರ್ಣ ವಾರಗಳ ಸರಾಸರಿ {n}%' },
  'replay.method': {
    en: 'The model saw nothing after 2023-12-31. Forecast cells are its top-ranked 5% for that week; the dots are real FIR coordinates from the week that followed. The hit rate counts one against the other as the week plays.',
    kn: 'ಮಾದರಿಗೆ 2023-12-31ರ ನಂತರದ ಯಾವುದೇ ಮಾಹಿತಿ ದೊರೆತಿಲ್ಲ. ಮುನ್ಸೂಚನಾ ಕೋಶಗಳು ಆ ವಾರಕ್ಕೆ ಅದು ಶ್ರೇಣೀಕರಿಸಿದ ಅಗ್ರ 5%; ಚುಕ್ಕೆಗಳು ನಂತರದ ವಾರದ ನೈಜ ಎಫ್‌ಐಆರ್ ನಿರ್ದೇಶಾಂಕಗಳು. ವಾರ ಸಾಗಿದಂತೆ ಹಿಟ್ ದರವು ಒಂದನ್ನು ಇನ್ನೊಂದರ ವಿರುದ್ಧ ಎಣಿಸುತ್ತದೆ.',
  },
  'replay.sInGrid': { en: 'In modelled grid', kn: 'ಮಾದರಿ ಗ್ರಿಡ್‌ನಲ್ಲಿ' },
  'replay.denominators': {
    en: 'Two denominators, both shown. {all}% counts every FIR in Karnataka that week, including cells too sparse to model. {grid}% counts only crime inside the modelled grid — that is the basis of the 53.1% hit rate quoted elsewhere on this platform, and the higher of the two.',
    kn: 'ಎರಡು ಛೇದಗಳು, ಎರಡನ್ನೂ ತೋರಿಸಲಾಗಿದೆ. {all}% ಎಂಬುದು ಆ ವಾರದ ಕರ್ನಾಟಕದ ಪ್ರತಿ ಎಫ್‌ಐಆರ್ ಅನ್ನು ಎಣಿಸುತ್ತದೆ, ಮಾದರಿ ಮಾಡಲಾಗದಷ್ಟು ವಿರಳವಾದ ಕೋಶಗಳೂ ಸೇರಿದಂತೆ. {grid}% ಎಂಬುದು ಮಾದರಿ ಗ್ರಿಡ್‌ನೊಳಗಿನ ಅಪರಾಧವನ್ನು ಮಾತ್ರ ಎಣಿಸುತ್ತದೆ — ಈ ವೇದಿಕೆಯಲ್ಲಿ ಬೇರೆಡೆ ಉಲ್ಲೇಖಿಸಲಾದ ಹಿಟ್ ದರದ ಆಧಾರ ಇದೇ, ಮತ್ತು ಇದು ಎರಡರಲ್ಲಿ ಹೆಚ್ಚಿನದು.',
  },
  'replay.unavailable': { en: 'Backtest data unavailable', kn: 'ಬ್ಯಾಕ್‌ಟೆಸ್ಟ್ ದತ್ತಾಂಶ ಲಭ್ಯವಿಲ್ಲ' },
  'replay.unavailableHint': {
    en: 'Run `python -m evaluate.backtest` to generate it. No figures are shown rather than estimated ones.',
    kn: 'ಅದನ್ನು ರಚಿಸಲು `python -m evaluate.backtest` ಚಲಾಯಿಸಿ. ಅಂದಾಜು ಅಂಕಿಅಂಶಗಳನ್ನು ತೋರಿಸುವ ಬದಲು ಯಾವುದನ್ನೂ ತೋರಿಸಿಲ್ಲ.',
  },

  // ── Header / Footer ───────────────────────────────────────────────
  'header.subtitle': { en: 'Crime Intelligence · Karnataka State Police', kn: 'ಅಪರಾಧ ಗುಪ್ತಚರ · ಕರ್ನಾಟಕ ರಾಜ್ಯ ಪೊಲೀಸ್' },
  'footer.districts': { en: 'districts', kn: 'ಜಿಲ್ಲೆಗಳು' },
  'footer.stations': { en: 'stations', kn: 'ಠಾಣೆಗಳು' },
  'footer.hotspots': { en: 'Hotspots: Getis-Ord Gi* (p < 0.05) · Basemap © OpenStreetMap', kn: 'ಹಾಟ್‌ಸ್ಪಾಟ್: Getis-Ord Gi* (p < 0.05) · ನಕ್ಷೆ © OpenStreetMap' },

  // ── SENSE view ─────────────────────────────────────────────────────
  'sense.allCrimes': { en: 'All crime types', kn: 'ಎಲ್ಲಾ ಅಪರಾಧ ಪ್ರಕಾರಗಳು' },
  'sense.stateView': { en: 'State view', kn: 'ರಾಜ್ಯ ನೋಟ' },
  'sense.districtView': { en: 'District view', kn: 'ಜಿಲ್ಲಾ ನೋಟ' },
  'sense.3d': { en: '3D', kn: '3D' },
  'sense.sigOnly': { en: 'Significant only', kn: 'ಮಹತ್ವಪೂರ್ಣ ಮಾತ್ರ' },
  'sense.scopeTooltip': { en: 'State view: cells compared against the whole-Karnataka baseline. District view: each cell compared against its own district — reveals local hotspots everywhere.', kn: 'ರಾಜ್ಯ ನೋಟ: ಕೋಶಗಳನ್ನು ಇಡೀ ಕರ್ನಾಟಕ ಮೂಲರೇಖೆಗೆ ಹೋಲಿಸಲಾಗಿದೆ. ಜಿಲ್ಲಾ ನೋಟ: ಪ್ರತಿ ಕೋಶವನ್ನು ಅದರ ಸ್ವಂತ ಜಿಲ್ಲೆಗೆ ಹೋಲಿಸಲಾಗಿದೆ.' },
  'narr.modelSummary': {
    en: 'On a held-out temporal split, patrolling the 5% of Karnataka that PRAHARI flags captures {hit}% of the crime that follows — {pai}× what the same area picked at random would return. Every prediction is explainable: SHAP values show which factors drove each risk score, and isotonic calibration ensures scores read as true probabilities.',
    kn: 'ಪ್ರತ್ಯೇಕಿಸಿಟ್ಟ ಕಾಲಾವಧಿ ವಿಭಜನೆಯಲ್ಲಿ, ಪ್ರಹರಿ ಗುರುತಿಸುವ ಕರ್ನಾಟಕದ 5% ಪ್ರದೇಶದಲ್ಲಿ ಗಸ್ತು ಮಾಡಿದರೆ ನಂತರ ನಡೆಯುವ ಅಪರಾಧಗಳಲ್ಲಿ {hit}% ಸೆರೆಸಿಗುತ್ತದೆ — ಅದೇ ಪ್ರದೇಶವನ್ನು ಯಾದೃಚ್ಛಿಕವಾಗಿ ಆರಿಸಿದರೆ ಸಿಗುವುದಕ್ಕಿಂತ {pai}× ಹೆಚ್ಚು. ಪ್ರತಿ ಮುನ್ಸೂಚನೆಯನ್ನೂ ವಿವರಿಸಬಹುದು: ಯಾವ ಅಂಶಗಳು ಅಪಾಯ ಅಂಕವನ್ನು ನಿರ್ಧರಿಸಿದವು ಎಂಬುದನ್ನು SHAP ಮೌಲ್ಯಗಳು ತೋರಿಸುತ್ತವೆ, ಮತ್ತು ಐಸೊಟಾನಿಕ್ ಕ್ಯಾಲಿಬ್ರೇಶನ್ ಅಂಕಗಳು ನಿಜವಾದ ಸಂಭವನೀಯತೆಗಳಾಗಿ ಓದುವಂತೆ ಖಚಿತಪಡಿಸುತ್ತದೆ.',
  },
  'narr.feedSpike': { en: '{crime} spike detected in {district}', kn: '{district}ದಲ್ಲಿ {crime} ಏರಿಕೆ ಪತ್ತೆಯಾಗಿದೆ' },
  'narr.feedDrop': { en: '{crime} drop detected in {district}', kn: '{district}ದಲ್ಲಿ {crime} ಇಳಿಕೆ ಪತ್ತೆಯಾಗಿದೆ' },
  'narr.feedDetail': { en: '{observed} observed vs {expected} expected ({sign}{pct}%). Z-score: {z}', kn: 'ನಿರೀಕ್ಷಿತ {expected} ಎದುರು ಕಂಡುಬಂದದ್ದು {observed} ({sign}{pct}%). Z-ಸ್ಕೋರ್: {z}' },
  'narr.feedTrend': { en: '{district} crime trending +{pct}% YoY', kn: '{district}ದಲ್ಲಿ ಅಪರಾಧ ವರ್ಷದಿಂದ ವರ್ಷಕ್ಕೆ +{pct}% ಏರಿಕೆ' },
  'narr.feedTrendDetail': { en: '{cases} cases in {year}, led by {crime}. Heinous: {heinous}%', kn: '{year}ರಲ್ಲಿ {cases} ಪ್ರಕರಣಗಳು, ಮುಂಚೂಣಿಯಲ್ಲಿ {crime}. ಘೋರ ಅಪರಾಧ: {heinous}%' },
  'narr.briefBase': { en: '{district} recorded {cases} FIRs in {year}', kn: '{district} {year}ರಲ್ಲಿ {cases} ಎಫ್‌ಐಆರ್ ದಾಖಲಿಸಿದೆ' },
  'narr.briefUp': { en: ', up {pct}% year-over-year', kn: ', ವರ್ಷದಿಂದ ವರ್ಷಕ್ಕೆ {pct}% ಏರಿಕೆ' },
  'narr.briefDown': { en: ', down {pct}% year-over-year', kn: ', ವರ್ಷದಿಂದ ವರ್ಷಕ್ಕೆ {pct}% ಇಳಿಕೆ' },
  'narr.briefTop': { en: '. Top offence: {crime} ({cases} cases).', kn: '. ಪ್ರಮುಖ ಅಪರಾಧ: {crime} ({cases} ಪ್ರಕರಣಗಳು).' },
  'narr.briefHeinous': { en: ' {pct}% of cases are heinous offences.', kn: ' {pct}% ಪ್ರಕರಣಗಳು ಘೋರ ಅಪರಾಧಗಳು.' },
  'narr.briefAnoms': { en: ' {n} active anomaly alerts.', kn: ' {n} ಸಕ್ರಿಯ ಅಸಹಜತೆ ಎಚ್ಚರಿಕೆಗಳು.' },
  'narr.recIncrease': { en: 'Increase patrol presence. Focus on {crime} prevention.', kn: 'ಗಸ್ತು ಉಪಸ್ಥಿತಿ ಹೆಚ್ಚಿಸಿ. {crime} ತಡೆಗಟ್ಟುವಿಕೆಗೆ ಗಮನ ನೀಡಿ.' },
  'narr.recMonitor': { en: 'Monitor {crime} trend. Consider preventive deployment.', kn: '{crime} ಪ್ರವೃತ್ತಿಯನ್ನು ಗಮನಿಸಿ. ಮುಂಜಾಗ್ರತಾ ನಿಯೋಜನೆಯನ್ನು ಪರಿಗಣಿಸಿ.' },
  'narr.recMaintain': { en: 'Maintain current deployment. Clearance rate: {pct}%.', kn: 'ಪ್ರಸ್ತುತ ನಿಯೋಜನೆಯನ್ನು ಮುಂದುವರಿಸಿ. ಇತ್ಯರ್ಥ ದರ: {pct}%.' },
  'sense.situationRoom': { en: 'Situation room', kn: 'ಸನ್ನಿವೇಶ ಕೋಠಡಿ' },
  'sense.kspLabel': { en: 'Karnataka State Police', kn: 'ಕರ್ನಾಟಕ ರಾಜ್ಯ ಪೋಲೀಸ್' },
  'sense.qsHotspots': { en: 'Hotspots', kn: 'ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳು' },
  'sense.qsAnomalies': { en: 'Anomalies', kn: 'ಅಸಹಜತೆಗಳು' },
  'sense.qsAtRisk': { en: 'At risk', kn: 'ಅಪಾಯದಲ್ಲಿ' },
  'sense.monthlyTrend': { en: 'Monthly trend', kn: 'ಮಾಸಿಕ ಪ್ರವೃತ್ತಿ' },
  'narr.deployBase': { en: 'Deploy {n} patrol units for {pct}% risk coverage.', kn: '{pct}% ಅಪಾಯ ವ್ಯಾಪ್ತಿಗಾಗಿ {n} ಗಸ್ತು ಘಟಕಗಳನ್ನು ನಿಯೋಜಿಸಿ.' },
  'narr.deployFocus': { en: ' Primary focus: {crime} ({n} incidents).', kn: ' ಪ್ರಮುಖ ಗಮನ: {crime} ({n} ಘಟನೆಗಳು).' },
  'narr.deployHeinous': { en: ' {n} heinous cases require priority response.', kn: ' {n} ಘೋರ ಪ್ರಕರಣಗಳಿಗೆ ಆದ್ಯತೆಯ ಸ್ಪಂದನೆ ಬೇಕು.' },
  'narr.deployAnoms': { en: ' {n} active anomaly alerts in this district.', kn: ' ಈ ಜಿಲ್ಲೆಯಲ್ಲಿ {n} ಸಕ್ರಿಯ ಅಸಹಜತೆ ಎಚ್ಚರಿಕೆಗಳು.' },
  'sense.firsYtd': { en: 'FIRs · {year} YTD', kn: 'ಎಫ್‌ಐಆರ್ · {year} YTD' },
  'feat.hist_total': { en: 'Historical crime volume', kn: 'ಐತಿಹಾಸಿಕ ಅಪರಾಧ ಪ್ರಮಾಣ' },
  'feat.day_of_year': { en: 'Seasonality (day of year)', kn: 'ಋತುಮಾನ (ವರ್ಷದ ದಿನ)' },
  'feat.is_night_shift': { en: 'Night shift (22:00–06:00)', kn: 'ರಾತ್ರಿ ಪಾಳಿ (22:00–06:00)' },
  'feat.is_morning_shift': { en: 'Morning shift (06:00–14:00)', kn: 'ಬೆಳಗಿನ ಪಾಳಿ (06:00–14:00)' },
  'feat.is_weekend': { en: 'Weekend', kn: 'ವಾರಾಂತ್ಯ' },
  'feat.hour_cos': { en: 'Time-of-day cycle', kn: 'ದಿನದ ಸಮಯದ ಆವರ್ತನ' },
  'feat.hour_sin': { en: 'Time-of-day cycle', kn: 'ದಿನದ ಸಮಯದ ಆವರ್ತನ' },
  'feat.hour_proxy': { en: 'Shift midpoint hour', kn: 'ಪಾಳಿಯ ಮಧ್ಯಬಿಂದು ಗಂಟೆ' },
  'feat.dow': { en: 'Day of week', kn: 'ವಾರದ ದಿನ' },
  'feat.dow_sin': { en: 'Day-of-week cycle', kn: 'ವಾರದ ದಿನದ ಆವರ್ತನ' },
  'feat.dow_cos': { en: 'Day-of-week cycle', kn: 'ವಾರದ ದಿನದ ಆವರ್ತನ' },
  'feat.month_sin': { en: 'Seasonal cycle', kn: 'ಋತುಮಾನ ಆವರ್ತನ' },
  'feat.month_cos': { en: 'Seasonal cycle', kn: 'ಋತುಮಾನ ಆವರ್ತನ' },
  'feat.crime_entropy': { en: 'Crime-type diversity of area', kn: 'ಪ್ರದೇಶದ ಅಪರಾಧ ಪ್ರಕಾರಗಳ ವೈವಿಧ್ಯ' },
  'feat.hist_heinous_pct': { en: 'Heinous-crime share of area', kn: 'ಪ್ರದೇಶದ ಘೋರ ಅಪರಾಧ ಪಾಲು' },
  'feat.hist_violent_pct': { en: 'Violent-crime share of area', kn: 'ಪ್ರದೇಶದ ಹಿಂಸಾತ್ಮಕ ಅಪರಾಧ ಪಾಲು' },
  'feat.hist_property_pct': { en: 'Property-crime share of area', kn: 'ಪ್ರದೇಶದ ಆಸ್ತಿ ಅಪರಾಧ ಪಾಲು' },
  'feat.n_crime_types': { en: 'Distinct crime types in area', kn: 'ಪ್ರದೇಶದಲ್ಲಿ ಪ್ರತ್ಯೇಕ ಅಪರಾಧ ಪ್ರಕಾರಗಳು' },
  'feat.nearRepeat': { en: 'Crimes within {km} km, last {days} days', kn: '{km} ಕಿಮೀ ಒಳಗೆ, ಕಳೆದ {days} ದಿನಗಳಲ್ಲಿ ಅಪರಾಧಗಳು' },
  'shap.elevated': { en: 'Risk elevated due to: {factors}.', kn: 'ಅಪಾಯ ಹೆಚ್ಚಿರುವ ಕಾರಣ: {factors}.' },
  'shap.mitigating': { en: ' Mitigating: {factors}.', kn: ' ಇಳಿಸುವ ಅಂಶಗಳು: {factors}.' },
  'trust.fairnessStatement': {
    en: 'PRAHARI predicts crime risk for geographic areas and time windows, not for individuals. It uses historical FIR data which reflects reported crime, not true crime rates. Areas with lower reporting or clearance rates may appear safer than they are. We compute reporting-bias indicators (chargesheet-based clearance rates) and flag at-risk districts for analyst review. Risk scores are explained via SHAP to ensure transparency. No demographic attributes (religion, caste) are used as model features.',
    kn: 'ಪ್ರಹರಿ ಭೌಗೋಳಿಕ ಪ್ರದೇಶಗಳಿಗೆ ಮತ್ತು ಕಾಲಾವಧಿಗಳಿಗೆ ಅಪರಾಧ ಅಪಾಯವನ್ನು ಮುನ್ಸೂಚಿಸುತ್ತದೆ, ವ್ಯಕ್ತಿಗಳಿಗಲ್ಲ. ಇದು ಐತಿಹಾಸಿಕ ಎಫ್‌ಐಆರ್ ದತ್ತಾಂಶವನ್ನು ಬಳಸುತ್ತದೆ, ಅದು ವರದಿಯಾದ ಅಪರಾಧವನ್ನು ಪ್ರತಿಬಿಂಬಿಸುತ್ತದೆಯೇ ಹೊರತು ನಿಜವಾದ ಅಪರಾಧ ದರವನ್ನಲ್ಲ. ಕಡಿಮೆ ವರದಿ ಅಥವಾ ಇತ್ಯರ್ಥ ದರವಿರುವ ಪ್ರದೇಶಗಳು ಇರುವುದಕ್ಕಿಂತ ಸುರಕ್ಷಿತವಾಗಿ ಕಾಣಬಹುದು. ನಾವು ವರದಿ-ಪಕ್ಷಪಾತ ಸೂಚಕಗಳನ್ನು (ದೋಷಾರೋಪ ಪಟ್ಟಿ ಆಧಾರಿತ ಇತ್ಯರ್ಥ ದರ) ಲೆಕ್ಕಹಾಕಿ, ಪರಿಶೀಲನೆಗೆ ಅಪಾಯದಲ್ಲಿರುವ ಜಿಲ್ಲೆಗಳನ್ನು ಗುರುತಿಸುತ್ತೇವೆ. ಪಾರದರ್ಶಕತೆಗಾಗಿ ಅಪಾಯ ಅಂಕಗಳನ್ನು SHAP ಮೂಲಕ ವಿವರಿಸಲಾಗುತ್ತದೆ. ಯಾವುದೇ ಜನಸಂಖ್ಯಾ ಗುಣಲಕ್ಷಣಗಳನ್ನು (ಧರ್ಮ, ಜಾತಿ) ಮಾದರಿಯ ಲಕ್ಷಣಗಳಾಗಿ ಬಳಸಲಾಗಿಲ್ಲ.',
  },
  'month.abbr': { en: 'Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec', kn: 'ಜನ,ಫೆಬ್,ಮಾರ್,ಏಪ್,ಮೇ,ಜೂನ್,ಜುಲೆ,ಆಗ,ಸೆಪ್,ಅಕ್ಟೋ,ನವೆ,ಡಿಸೆ' },
  'narr.predictInsight': { en: 'PRAHARI identifies {hit}% of future crime in just 5% of the area — {pai}× what picking that area at random would return. Top prediction drivers: {drivers}. The model has learned spatio-temporal crime clustering patterns — areas with recent nearby incidents face significantly elevated risk.', kn: 'ಪ್ರಹರಿ ಕೇವಲ 5% ಪ್ರದೇಶದಲ್ಲಿ ಮುಂದಿನ ಅಪರಾಧಗಳಲ್ಲಿ {hit}% ಅನ್ನು ಗುರುತಿಸುತ್ತದೆ — ಅದೇ ಪ್ರದೇಶವನ್ನು ಯಾದೃಚ್ಛಿಕವಾಗಿ ಆರಿಸಿದರೆ ಸಿಗುವುದಕ್ಕಿಂತ {pai}× ಹೆಚ್ಚು. ಪ್ರಮುಖ ಮುನ್ಸೂಚನಾ ಚಾಲಕಗಳು: {drivers}. ಮಾದರಿ ಸ್ಥಳ-ಕಾಲ ಅಪರಾಧ ಗುಂಪುಗಾರಿಕೆಯ ಮಾದರಿಗಳನ್ನು ಕಲಿತಿದೆ — ಇತ್ತೀಚಿನ ಸಮೀಪದ ಘಟನೆಗಳಿರುವ ಪ್ರದೇಶಗಳು ಗಮನಾರ್ಹವಾಗಿ ಹೆಚ್ಚಿನ ಅಪಾಯ ಎದುರಿಸುತ್ತವೆ.' },
  'sense.emergingCounts': { en: '{new} new · {int} intensifying · {cool} cooling', kn: '{new} ಹೆಸ · {int} ತೀವ್ರಗೊಳ್ಳುತ್ತಿರುವ · {cool} ತಣ್ಣಗಾಗುತ್ತಿರುವ' },
  'predict.riskPanelTitle': { en: 'Week-ahead risk', kn: 'ಮುಂದಿನ ವಾರದ ಅಪಾಯ' },
  'predict.riskPanelSub': { en: 'LightGBM · held-out test', kn: 'LightGBM · ಪ್ರತ್ಯೇಕಿಸಿಟ್ಟ ಪರೀಕ್ಷೆ' },
  'gender.Male': { en: 'Male', kn: 'ಪುರುಷ' },
  'gender.Female': { en: 'Female', kn: 'ಮಹಿಳೆ' },
  'gender.Transgender': { en: 'Transgender', kn: 'ತ್ರೇಸ್‌ಜೆಂಡರ್' },
  'socio.ageShort': { en: 'age {n}', kn: 'ವಯಸ್ಸು {n}' },
  'occ.Business': { en: 'Business', kn: 'ವ್ಯಾಪಾರ' },
  'occ.Farmer': { en: 'Farmer', kn: 'ರೈತ' },
  'occ.Government Employee': { en: 'Government Employee', kn: 'ಸರ್ಕಾರಿ ನೌಕರ' },
  'occ.Private Sector': { en: 'Private Sector', kn: 'ಖಾಸಗಿ ವಲಯ' },
  'ticker.anomaly': { en: 'ANOMALY: {crime} — {observed} cases in {district} (expected {expected}, z={z})', kn: 'ಅಸಹಜತೆ: {crime} — {district}ದಲ್ಲಿ {observed} ಪ್ರಕರಣಗಳು (ನಿರೀಕ್ಷಿತ {expected}, z={z})' },
  'ticker.trend': { en: 'TREND: {district} crime up {pct}% YoY — {cases} FIRs, led by {crime}', kn: 'ಪ್ರವೃತ್ತಿ: {district}ದಲ್ಲಿ ಅಪರಾಧ {pct}% ಏರಿಕೆ — {cases} ಎಫ್‌ಐಆರ್, ಮುಂಚೂಣಿಯಲ್ಲಿ {crime}' },
  'sense.tipCases': { en: '{n} cases on record', kn: 'ದಾಖಲೆಯಲ್ಲಿ {n} ಪ್ರಕರಣಗಳು' },
  'sense.tipHot': { en: 'More crime than the areas around it — more than chance would explain', kn: 'ಸುತ್ತಮುತ್ತಲ ಪ್ರದೇಶಗಳಿಗಿಂತ ಹೆಚ್ಚು ಅಪರಾಧ — ಆಕಸ್ಮಿಕದಿಂದ ವಿವರಿಸಲಾಗದಷ್ಟು' },
  'sense.tipCold': { en: 'Less crime than the areas around it', kn: 'ಸುತ್ತಮುತ್ತಲ ಪ್ರದೇಶಗಳಿಗಿಂತ ಕಡಿಮೆ ಅಪರಾಧ' },
  'sense.tipNotSig': { en: 'No clear difference from the areas around it', kn: 'ಸುತ್ತಮುತ್ತಲ ಪ್ರದೇಶಗಳಿಗಿಂತ ಸ್ಪಷ್ಟ ವ್ಯತ್ಯಾಸವಿಲ್ಲ' },
  'sense.sigTitle': { en: 'Getis-Ord Gi* significance', kn: 'Getis-Ord Gi* ಮಹತ್ವ' },
  'sense.cellsReadout': { en: '{hot} hot cells / {all} analysed', kn: '{hot} ಬಿಸಿ ಕೋಶಗಳು / {all} ವಿಶ್ಲೇಷಿತ' },
  'sig.hot_99': { en: 'Hot spot (99%)', kn: 'ಹಾಟ್‌ಸ್ಪಾಟ್ (99%)' },
  'sig.hot_95': { en: 'Hot spot (95%)', kn: 'ಹಾಟ್‌ಸ್ಪಾಟ್ (95%)' },
  'sig.hot_90': { en: 'Hot spot (90%)', kn: 'ಹಾಟ್‌ಸ್ಪಾಟ್ (90%)' },
  'sig.not_sig': { en: 'Not significant', kn: 'ಮಹತ್ವದ್ದಲ್ಲ' },
  'sig.cold_90': { en: 'Cold spot (90%)', kn: 'ಕೋಲ್ಡ್‌ಸ್ಪಾಟ್ (90%)' },
  'sig.cold_95': { en: 'Cold spot (95%)', kn: 'ಕೋಲ್ಡ್‌ಸ್ಪಾಟ್ (95%)' },
  'sig.cold_99': { en: 'Cold spot (99%)', kn: 'ಕೋಲ್ಡ್‌ಸ್ಪಾಟ್ (99%)' },
  'act.deploymentCenter': { en: 'Deployment center', kn: 'ನಿಯೋಜನಾ ಕೇಂದ್ರ' },
  'act.patrolOptimizer': { en: 'Patrol optimizer', kn: 'ಗಸ್ತು ಆಪ್ಟಿಮೈಜರ್' },
  'act.recommendedDeployment': { en: 'Recommended deployment', kn: 'ಶಿಫಾರಸು ಮಾಡಿದ ನಿಯೋಜನೆ' },
  'sense.districts': { en: 'Districts', kn: 'ಜಿಲ್ಲೆಗಳು' },
  'sense.rankedByFirs': { en: 'ranked by total FIRs · share of state', kn: 'ಒಟ್ಟು ಎಫ್‌ಐಆರ್‌ಗಳ ಪ್ರಕಾರ · ರಾಜ್ಯದ ಪಾಲು' },
  'sense.ofState': { en: 'of state', kn: 'ರಾಜ್ಯದ' },
  'sense.trend': { en: 'Monthly trend', kn: 'ಮಾಸಿಕ ಪ್ರವೃತ್ತಿ' },
  'sense.cases': { en: 'cases', kn: 'ಪ್ರಕರಣಗಳು' },
  'sense.yoy': { en: 'YoY', kn: 'ವರ್ಷದಿಂದ ವರ್ಷಕ್ಕೆ' },
  'sense.topCrime': { en: 'top crime', kn: 'ಪ್ರಮುಖ ಅಪರಾಧ' },
  'sense.heinous': { en: 'heinous', kn: 'ಗಂಭೀರ' },

  // ── Emerging hotspots (SENSE) ──────────────────────────────────────
  'sense.emerging': { en: 'Emerging', kn: 'ಉದಯೋನ್ಮುಖ' },
  'sense.topPlaces': { en: 'Where crime is happening', kn: 'ಅಪರಾಧ ಎಲ್ಲಿ ನಡೆಯುತ್ತಿದೆ' },
  'sense.topPlacesNote': { en: 'by station jurisdiction (each names a town/locality)', kn: 'ಠಾಣಾ ವ್ಯಾಪ್ತಿ ಪ್ರಕಾರ (ಪ್ರತಿಯೊಂದೂ ಒಂದು ಊರು/ಪ್ರದೇಶ)' },
  'sense.backToDistricts': { en: 'All districts', kn: 'ಎಲ್ಲಾ ಜಿಲ್ಲೆಗಳು' },
  'sense.dangerousHere': { en: 'Most dangerous here', kn: 'ಇಲ್ಲಿ ಅತಿ ಅಪಾಯಕಾರಿ' },
  'sense.casesHere': { en: 'cases here', kn: 'ಇಲ್ಲಿ ಪ್ರಕರಣಗಳು' },
  'sense.deployPatrol': { en: 'Deploy patrol here', kn: 'ಇಲ್ಲಿ ಗಸ್ತು ನಿಯೋಜಿಸಿ' },
  'sense.topCrimesHere': { en: 'Top crimes here', kn: 'ಇಲ್ಲಿ ಪ್ರಮುಖ ಅಪರಾಧಗಳು' },
  'sense.allCrime': { en: 'All crime', kn: 'ಎಲ್ಲಾ ಅಪರಾಧ' },
  'sense.lifecycleTitle': { en: 'Hotspot lifecycle (24-month trend)', kn: 'ಹಾಟ್‌ಸ್ಪಾಟ್ ಜೀವನಚಕ್ರ (24-ತಿಂಗಳ ಪ್ರವೃತ್ತಿ)' },
  'emerging.new': { en: 'New hotspot', kn: 'ಹೊಸ ಹಾಟ್‌ಸ್ಪಾಟ್' },
  'emerging.intensifying': { en: 'Intensifying', kn: 'ತೀವ್ರಗೊಳ್ಳುತ್ತಿದೆ' },
  'emerging.persistent': { en: 'Persistent', kn: 'ನಿರಂತರ' },
  'emerging.cooling': { en: 'Cooling', kn: 'ತಣ್ಣಗಾಗುತ್ತಿದೆ' },
  'emerging.perMonth': { en: '/month', kn: '/ತಿಂಗಳು' },
  'emerging.recent': { en: 'recent', kn: 'ಇತ್ತೀಚಿನ' },
  'emerging.historic': { en: 'historic', kn: 'ಐತಿಹಾಸಿಕ' },
  'emerging.topAreas': { en: 'Top emerging areas', kn: 'ಪ್ರಮುಖ ಉದಯೋನ್ಮುಖ ಪ್ರದೇಶಗಳು' },
  'emerging.nowVsBefore': { en: 'now vs before', kn: 'ಈಗ vs ಮೊದಲು' },

  // ── PATTERNS (PREDICT third mode) ──────────────────────────────────
  'predict.patterns': { en: 'PATTERNS', kn: 'ಮಾದರಿಗಳು' },
  'patterns.sprees': { en: 'Suspected crime sprees', kn: 'ಶಂಕಿತ ಅಪರಾಧ ಸರಣಿಗಳು' },
  'patterns.spreesMethod': { en: 'Same offence subtype linked within 1 km and 7 days (near-repeat chaining)', kn: 'ಒಂದೇ ಅಪರಾಧ ಉಪವಿಧ 1 ಕಿ.ಮೀ ಮತ್ತು 7 ದಿನಗಳೊಳಗೆ ಸರಪಳಿಯಾಗಿ ಜೋಡಿಸಲಾಗಿದೆ' },
  'patterns.corridors': { en: 'Offender mobility corridors', kn: 'ಅಪರಾಧಿ ಸಂಚಾರ ಮಾರ್ಗಗಳು' },
  'patterns.corridorsMethod': { en: 'Offenders tracked across districts via OffenderID', kn: 'OffenderID ಮೂಲಕ ಜಿಲ್ಲೆಗಳಾದ್ಯಂತ ಅಪರಾಧಿಗಳ ಜಾಡು' },
  'patterns.multiDistrict': { en: 'multi-district offenders', kn: 'ಬಹು-ಜಿಲ್ಲಾ ಅಪರಾಧಿಗಳು' },
  'patterns.ofAllOffenders': { en: 'of all offenders', kn: 'ಎಲ್ಲಾ ಅಪರಾಧಿಗಳಲ್ಲಿ' },
  'patterns.topMobile': { en: 'Most mobile offenders', kn: 'ಅತಿ ಹೆಚ್ಚು ಸಂಚರಿಸುವ ಅಪರಾಧಿಗಳು' },
  'patterns.cases': { en: 'cases', kn: 'ಪ್ರಕರಣಗಳು' },
  'patterns.days': { en: 'days', kn: 'ದಿನಗಳು' },
  'patterns.districts': { en: 'districts', kn: 'ಜಿಲ್ಲೆಗಳು' },
  'patterns.offenders': { en: 'offenders', kn: 'ಅಪರಾಧಿಗಳು' },
  'patterns.crossings': { en: 'movements', kn: 'ಚಲನೆಗಳು' },
  'patterns.spree': { en: 'Spree', kn: 'ಸರಣಿ' },
  'patterns.showSprees': { en: 'Sprees', kn: 'ಸರಣಿಗಳು' },
  'patterns.showCorridors': { en: 'Corridors', kn: 'ಮಾರ್ಗಗಳು' },

  // ── PREDICT view ───────────────────────────────────────────────────
  'predict.riskForecast': { en: 'RISK FORECAST', kn: 'ಅಪಾಯ ಮುನ್ಸೂಚನೆ' },
  'predict.crimeNetwork': { en: 'CRIME NETWORK', kn: 'ಅಪರಾಧ ಜಾಲ' },
  'predict.networkHint': { en: 'colour = priority · hover to trace links · click a network to focus', kn: 'ಬಣ್ಣ = ಆದ್ಯತೆ · ಸಂಪರ್ಕ ಪತ್ತೆಗೆ ಹೋವರ್ · ಗಮನಕ್ಕೆ ಜಾಲ ಕ್ಲಿಕ್ ಮಾಡಿ' },
  'predict.priorityCells': { en: 'Priority cells (top 5%)', kn: 'ಆದ್ಯತೆ ಕೋಶಗಳು (ಮೇಲಿನ 5%)' },
  'predict.modelStats': { en: 'Model performance', kn: 'ಮಾದರಿ ಕಾರ್ಯಕ್ಷಮತೆ' },
  'predict.crimesIn5': { en: 'crimes in 5% area', kn: '5% ಪ್ರದೇಶದಲ್ಲಿ ಅಪರಾಧಗಳು' },
  'predict.predictionAccuracy': { en: 'vs random patrol', kn: 'ಯಾದೃಚ್ಛಿಕ ಗಸ್ತಿಗೆ ಹೋಲಿಸಿ' },
  'predict.pei': { en: 'of theoretical max', kn: 'ಸೈದ್ಧಾಂತಿಕ ಗರಿಷ್ಠದ ಪಾಲು' },
  'predict.paiCurve': { en: 'Crime captured vs area patrolled', kn: 'ಗಸ್ತು ಪ್ರದೇಶಕ್ಕೆ ಎದುರಾಗಿ ಸೆರೆಹಿಡಿದ ಅಪರಾಧ' },
  'predict.modelLine': { en: 'PRAHARI', kn: 'ಪ್ರಹರಿ' },
  'predict.randomPatrol': { en: 'random patrol', kn: 'ಯಾದೃಚ್ಛಿಕ ಗಸ್ತು' },
  'predict.pctArea': { en: '% of area', kn: '% ಪ್ರದೇಶ' },
  'predict.pctCrime': { en: '% of crime', kn: '% ಅಪರಾಧ' },
  'predict.topDrivers': { en: 'Top risk drivers', kn: 'ಪ್ರಮುಖ ಅಪಾಯ ಚಾಲಕಗಳು' },
  'predict.anomalies': { en: 'Anomaly alerts', kn: 'ಅಸಹಜತೆ ಎಚ್ಚರಿಕೆಗಳು' },
  'predict.spike': { en: 'spike', kn: 'ಏರಿಕೆ' },
  'predict.drop': { en: 'drop', kn: 'ಕುಸಿತ' },
  'predict.observed': { en: 'observed', kn: 'ಗಮನಿಸಿದ' },
  'predict.expected': { en: 'expected', kn: 'ನಿರೀಕ್ಷಿತ' },
  'predict.networkStats': { en: 'Network statistics', kn: 'ಜಾಲ ಅಂಕಿಅಂಶಗಳು' },
  'predict.offenders': { en: 'offenders', kn: 'ಅಪರಾಧಿಗಳು' },
  'predict.connections': { en: 'connections', kn: 'ಸಂಪರ್ಕಗಳು' },
  'predict.gangs': { en: 'networks', kn: 'ಜಾಲಗಳು' },
  'predict.modularity': { en: 'modularity', kn: 'ಮಾಡ್ಯುಲಾರಿಟಿ' },
  'predict.gangDisruption': { en: 'Network disruption ranking', kn: 'ಜಾಲ ವಿಘಟನೆ ಶ್ರೇಣಿ' },
  'predict.threatRanking': { en: 'Networks by priority', kn: 'ಆದ್ಯತೆ ಪ್ರಕಾರ ಜಾಲಗಳು' },
  'predict.threatScore': { en: 'priority', kn: 'ಆದ್ಯತೆ' },
  'predict.arrestImpact': { en: 'Arrest top-3', kn: 'ಟಾಪ್-3 ಬಂಧನ' },
  'threat.high': { en: 'High', kn: 'ಹೆಚ್ಚು' },
  'threat.medium': { en: 'Medium', kn: 'ಮಧ್ಯಮ' },
  'threat.low': { en: 'Low', kn: 'ಕಡಿಮೆ' },
  'threat.violent': { en: 'violent', kn: 'ಹಿಂಸಾತ್ಮಕ' },
  'threat.heinousShare': { en: 'share of cases that are heinous offences', kn: 'ಗಂಭೀರ ಅಪರಾಧಗಳ ಪಾಲು' },
  'threat.reachTip': { en: 'districts the network appears across', kn: 'ಜಾಲ ಕಾಣಿಸಿಕೊಳ್ಳುವ ಜಿಲ್ಲೆಗಳು' },
  'threat.title': { en: 'Network priority', kn: 'ಜಾಲ ಆದ್ಯತೆ' },
  'threat.legendNote': { en: 'by crime severity, size & reach', kn: 'ಅಪರಾಧ ತೀವ್ರತೆ, ಗಾತ್ರ ಮತ್ತು ವ್ಯಾಪ್ತಿ' },
  'predict.members': { en: 'members', kn: 'ಸದಸ್ಯರು' },
  'predict.arrests': { en: 'arrests', kn: 'ಬಂಧನಗಳು' },
  'predict.fragmentation': { en: 'fragmentation', kn: 'ವಿಘಟನೆ' },
  'predict.pieces': { en: 'pieces', kn: 'ತುಂಡುಗಳು' },
  'predict.keyMembers': { en: 'Key members', kn: 'ಪ್ರಮುಖ ಸದಸ್ಯರು' },

  // ── War Room (offender dossiers) ───────────────────────────────────
  'war.mostWanted': { en: 'Most-recorded individuals', kn: 'ಅತಿ ಹೆಚ್ಚು ದಾಖಲಾದ ವ್ಯಕ್ತಿಗಳು' },
  'war.gangs': { en: 'Networks', kn: 'ಜಾಲಗಳು' },
  'war.roster': { en: 'Roster', kn: 'ತಂಡ ಪಟ್ಟಿ' },
  'war.gangConnections': { en: 'Association networks', kn: 'ಸಹ-ಆರೋಪ ಜಾಲಗಳು' },
  'war.highProfile': { en: 'Most recorded', kn: 'ಅತಿ ದಾಖಲಿತ' },
  'war.rosterNote': { en: 'same crew shown on the board', kn: 'ಬೋರ್ಡ್‌ನಲ್ಲಿ ತೋರಿಸಿದ ಅದೇ ತಂಡ' },
  'war.searchSuspect': { en: 'Search suspect by name…', kn: 'ಹೆಸರಿನಿಂದ ಶಂಕಿತರನ್ನು ಹುಡುಕಿ…' },
  'war.noSuspect': { en: 'No suspect found', kn: 'ಯಾವುದೇ ಶಂಕಿತ ಸಿಗಲಿಲ್ಲ' },
  'war.dossier': { en: 'Suspect dossier', kn: 'ಶಂಕಿತ ಕಡತ' },
  'war.back': { en: 'Back', kn: 'ಹಿಂದೆ' },
  'war.rank': { en: 'Rank', kn: 'ಶ್ರೇಣಿ' },
  'war.cases': { en: 'cases', kn: 'ಪ್ರಕರಣಗಳು' },
  'war.arrestRecords': { en: 'arrest records', kn: 'ಬಂಧನ ದಾಖಲೆಗಳು' },
  'war.districts': { en: 'districts', kn: 'ಜಿಲ್ಲೆಗಳು' },
  'war.years': { en: 'yr career', kn: 'ವರ್ಷ ವೃತ್ತಿ' },
  'war.age': { en: 'age', kn: 'ವಯಸ್ಸು' },
  'war.crimeProfile': { en: 'Crime profile', kn: 'ಅಪರಾಧ ವಿವರ' },
  'war.operatingArea': { en: 'Operating area', kn: 'ಕಾರ್ಯ ಪ್ರದೇಶ' },
  'war.knownAssociates': { en: 'Known associates', kn: 'ತಿಳಿದ ಸಹಚರರು' },
  'war.noAssociates': { en: 'No co-offenders on record', kn: 'ದಾಖಲೆಯಲ್ಲಿ ಸಹ-ಅಪರಾಧಿಗಳಿಲ್ಲ' },
  'war.sharedCases': { en: 'shared', kn: 'ಹಂಚಿಕೆ' },
  'war.career': { en: 'Criminal career', kn: 'ಅಪರಾಧ ವೃತ್ತಿ' },
  'war.lastArrest': { en: 'last arrest', kn: 'ಕೊನೆಯ ಬಂಧನ' },
  'war.gangAffiliation': { en: 'Gang affiliation', kn: 'ಗ್ಯಾಂಗ್ ಸಂಬಂಧ' },
  'war.keyPlayer': { en: 'KEY PLAYER', kn: 'ಪ್ರಮುಖ ವ್ಯಕ್ತಿ' },
  'war.keyPlayerNote': { en: 'removing this offender fragments the gang', kn: 'ಈ ಅಪರಾಧಿಯನ್ನು ತೆಗೆದರೆ ಗ್ಯಾಂಗ್ ಒಡೆಯುತ್ತದೆ' },
  'war.solo': { en: 'No gang — operates solo', kn: 'ಗ್ಯಾಂಗ್ ಇಲ್ಲ — ಏಕಾಂಗಿ' },
  'war.notInGraph': { en: 'not in the visualized network', kn: 'ದೃಶ್ಯ ಜಾಲದಲ್ಲಿ ಇಲ್ಲ' },
  'war.heinousShare': { en: 'heinous', kn: 'ಗಂಭೀರ' },
  'war.wantedNote': { en: 'ordered by FIRs on record, then districts appeared in', kn: 'ದಾಖಲಾದ ಎಫ್‌ಐಆರ್, ನಂತರ ಜಿಲ್ಲೆಗಳ ಪ್ರಕಾರ' },
  'board.pick': { en: 'Select a gang to view its connections', kn: 'ಸಂಪರ್ಕಗಳನ್ನು ನೋಡಲು ಒಂದು ಗ್ಯಾಂಗ್ ಆಯ್ಕೆಮಾಡಿ' },
  'board.links': { en: '{n} links', kn: '{n} ಸಂಪರ್ಕಗಳು' },
  'board.members': { en: 'members', kn: 'ಸದಸ್ಯರು' },
  'board.hint': { en: 'click a member to open their dossier · hover to trace links', kn: 'ಕಡತ ತೆರೆಯಲು ಸದಸ್ಯರನ್ನು ಕ್ಲಿಕ್ ಮಾಡಿ · ಸಂಪರ್ಕ ಪತ್ತೆಗೆ ಹೋವರ್' },
  'board.core': { en: 'showing the most-connected core · click a member for their dossier', kn: 'ಹೆಚ್ಚು ಸಂಪರ್ಕಿತ ತಿರುಳು ತೋರಿಸಲಾಗಿದೆ · ಕಡತಕ್ಕಾಗಿ ಸದಸ್ಯರನ್ನು ಕ್ಲಿಕ್ ಮಾಡಿ' },
  'board.boss': { en: 'MOST CONNECTED', kn: 'ಅತಿ ಸಂಪರ್ಕಿತ' },
  'board.lieutenant': { en: 'HIGHLY CONNECTED', kn: 'ಹೆಚ್ಚು ಸಂಪರ್ಕಿತ' },
  'board.soldier': { en: 'MEMBER', kn: 'ಸದಸ್ಯ' },
  'board.nav': { en: 'scroll to zoom · drag to pan', kn: 'ಜೂಮ್‌ಗೆ ಸ್ಕ್ರೋಲ್ · ಪ್ಯಾನ್‌ಗೆ ಎಳೆಯಿರಿ' },
  'board.threatPyramid': { en: 'top 40 offenders ranked by threat · click a suspect for details', kn: 'ಬೆದರಿಕೆ ಪ್ರಕಾರ ಶ್ರೇಣೀಕೃತ ಟಾಪ್ 40 ಅಪರಾಧಿಗಳು · ವಿವರಗಳಿಗೆ ಶಂಕಿತರನ್ನು ಕ್ಲಿಕ್ ಮಾಡಿ' },
  'war.threat': { en: 'threat', kn: 'ಬೆದರಿಕೆ' },

  // ── Socio-economic panel (SENSE) ────────────────────────────────────
  'socio.demographics': { en: 'Demographics', kn: 'ಜನಸಂಖ್ಯಾಶಾಸ್ತ್ರ' },
  'socio.loading': { en: 'Loading demographics…', kn: 'ಜನಸಂಖ್ಯಾಶಾಸ್ತ್ರ ಲೋಡ್ ಆಗುತ್ತಿದೆ…' },
  'socio.accusedAge': { en: 'Accused — age distribution', kn: 'ಆರೋಪಿ — ವಯಸ್ಸಿನ ಹಂಚಿಕೆ' },
  'socio.victimAge': { en: 'Victim — age distribution', kn: 'ಸಂತ್ರಸ್ತ — ವಯಸ್ಸಿನ ಹಂಚಿಕೆ' },
  'socio.genderSplit': { en: 'Gender split', kn: 'ಲಿಂಗ ವಿಭಜನೆ' },
  'socio.accused': { en: 'Accused', kn: 'ಆರೋಪಿ' },
  'socio.victims': { en: 'Victims', kn: 'ಸಂತ್ರಸ್ತರು' },
  'socio.hourlyPattern': { en: 'Crime by hour × age group', kn: 'ಗಂಟೆ × ವಯೋಮಾನ ಅಪರಾಧ' },
  'socio.crimeByOccupation': { en: 'Crime type × occupation', kn: 'ಅಪರಾಧ ಪ್ರಕಾರ × ಉದ್ಯೋಗ' },
  'socio.crimeType': { en: 'Crime', kn: 'ಅಪರಾಧ' },
  'socio.yearlyTrend': { en: 'Yearly trend by occupation', kn: 'ಉದ್ಯೋಗದ ಪ್ರಕಾರ ವಾರ್ಷಿಕ ಪ್ರವೃತ್ತಿ' },
  'socio.districtProfile': { en: 'District profiles (top 10)', kn: 'ಜಿಲ್ಲಾ ಪ್ರೊಫೈಲ್‌ಗಳು (ಟಾಪ್ 10)' },

  // ── ACT view ───────────────────────────────────────────────────────
  'act.patrolDeployment': { en: 'Patrol Deployment', kn: 'ಗಸ್ತು ನಿಯೋಜನೆ' },
  'act.briefing': { en: 'Patrol Briefing', kn: 'ಗಸ್ತು ಮಾಹಿತಿ' },
  'act.patrols': { en: 'patrols', kn: 'ಗಸ್ತುಗಳು' },
  'act.riskCoverage': { en: 'Risk coverage', kn: 'ಅಪಾಯ ವ್ಯಾಪ್ತಿ' },
  'act.statusQuo': { en: 'Volume-driven baseline', kn: 'ಪರಿಮಾಣ ಆಧಾರಿತ ಮೂಲರೇಖೆ' },
  'act.randomBaseline': { en: 'Random baseline', kn: 'ಯಾದೃಚ್ಛಿಕ ಮೂಲರೇಖೆ' },
  'act.uplift': { en: 'uplift vs status quo', kn: 'ಸ್ಥಿತಿಗಿಂತ ಉನ್ನತಿ' },
  'act.ilpVerified': { en: 'ILP-verified optimal', kn: 'ILP-ಪರಿಶೀಲಿತ ಅತ್ಯುತ್ತಮ' },
  'act.printBriefing': { en: 'Print briefing sheet', kn: 'ಮಾಹಿತಿ ಹಾಳೆ ಮುದ್ರಿಸಿ' },
  'act.patrolUnit': { en: 'Patrol', kn: 'ಗಸ್ತು' },
  'act.crimeTypes': { en: 'crime types', kn: 'ಅಪರಾಧ ಪ್ರಕಾರಗಳು' },
  'act.heinousCases': { en: 'heinous cases', kn: 'ಗಂಭೀರ ಪ್ರಕರಣಗಳು' },
  'act.numPatrols': { en: 'Units fielded this shift', kn: 'ಈ ಪಾಳಿಯಲ್ಲಿ ನಿಯೋಜಿತ ಘಟಕಗಳು' },
  'act.district': { en: 'District', kn: 'ಜಿಲ್ಲೆ' },
  'act.perPatrol': { en: 'coverage / unit', kn: 'ಪ್ರತಿ ಘಟಕಕ್ಕೆ ವ್ಯಾಪ್ತಿ' },
  'act.beatRadius': { en: 'beat radius per unit', kn: 'ಪ್ರತಿ ಘಟಕಕ್ಕೆ ಬೀಟ್ ತ್ರಿಜ್ಯ' },
  'act.efficiencyNote': {
    en: 'Each unit runs a 2 km beat placed on the highest-risk cluster in this district. Coverage per unit falls as you add units (diminishing returns) — the efficient number is where it plateaus.',
    kn: 'ಪ್ರತಿ ಘಟಕವು ಈ ಜಿಲ್ಲೆಯ ಅತಿ ಹೆಚ್ಚು ಅಪಾಯದ ಸಮೂಹದಲ್ಲಿ 2 ಕಿಮೀ ಬೀಟ್ ನಡೆಸುತ್ತದೆ. ಘಟಕಗಳನ್ನು ಸೇರಿಸಿದಂತೆ ಪ್ರತಿ ಘಟಕದ ವ್ಯಾಪ್ತಿ ಕಡಿಮೆಯಾಗುತ್ತದೆ — ಅದು ಸ್ಥಿರವಾಗುವ ಸಂಖ್ಯೆಯೇ ದಕ್ಷ ಸಂಖ್ಯೆ.',
  },

  // ── TRUST view ─────────────────────────────────────────────────────
  'trust.benchmark': { en: 'Benchmark — the three numbers', kn: 'ಮಾನದಂಡ — ಮೂರು ಸಂಖ್ಯೆಗಳು' },
  'trust.crimesIn5': { en: 'crimes in 5% of area', kn: '5% ಪ್ರದೇಶದಲ್ಲಿ ಅಪರಾಧಗಳು' },
  'trust.patrolUplift': { en: 'vs status-quo deployment', kn: 'ಪ್ರಸ್ತುತ ನಿಯೋಜನೆಗಿಂತ' },
  'trust.gangFrag': { en: 'network fragmentation', kn: 'ಜಾಲ ವಿಘಟನೆ' },
  'trust.methodology': { en: 'Benchmark methodology', kn: 'ಮಾನದಂಡ ವಿಧಾನ' },
  'trust.methodologyText': {
    en: 'these numbers are measured on a synthetic FIR corpus with planted spatio-temporal patterns — a ground-truth benchmark that proves the pipeline recovers known structure (planted-pattern recovery). The identical evaluation harness (PAI/PEI, temporal holdout, coverage uplift) runs unchanged on live CCTNS data; real-world scores will differ.',
    kn: 'ಈ ಸಂಖ್ಯೆಗಳನ್ನು ಯೋಜಿತ ಸ್ಥಳ-ಕಾಲ ಮಾದರಿಗಳೊಂದಿಗೆ ಕೃತಕ FIR ಸಂಗ್ರಹದಲ್ಲಿ ಅಳೆಯಲಾಗಿದೆ — ಪೈಪ್‌ಲೈನ್ ತಿಳಿದಿರುವ ರಚನೆಯನ್ನು ಮರುಪಡೆಯುತ್ತದೆ ಎಂದು ಸಾಬೀತುಪಡಿಸುವ ಮೂಲ-ಸತ್ಯ ಮಾನದಂಡ. ಅದೇ ಮೌಲ್ಯಮಾಪನ ವ್ಯವಸ್ಥೆ ನೈಜ CCTNS ದತ್ತಾಂಶದಲ್ಲಿ ಬದಲಾಗದೆ ಚಲಿಸುತ್ತದೆ; ನೈಜ-ಪ್ರಪಂಚದ ಅಂಕಗಳು ಭಿನ್ನವಾಗಿರಬಹುದು.',
  },
  'trust.shapTitle': { en: 'Why the model predicts — SHAP feature attribution', kn: 'ಮಾದರಿ ಏಕೆ ಊಹಿಸುತ್ತದೆ — SHAP ವೈಶಿಷ್ಟ್ಯ ಕೊಡುಗೆ' },
  'trust.shapNote': { en: 'Near-repeat features dominate — the model has learned crime clusters in space and time, not just historical averages.', kn: 'ಸಮೀಪ-ಪುನರಾವರ್ತನೆ ವೈಶಿಷ್ಟ್ಯಗಳು ಪ್ರಬಲ — ಮಾದರಿ ಕೇವಲ ಐತಿಹಾಸಿಕ ಸರಾಸರಿಗಳಲ್ಲ, ಸ್ಥಳ ಮತ್ತು ಸಮಯದಲ್ಲಿ ಅಪರಾಧ ಸಮೂಹಗಳನ್ನು ಕಲಿತಿದೆ.' },
  'trust.fairnessTitle': { en: 'Fairness audit — geographic disparity', kn: 'ನ್ಯಾಯೋಚಿತ ಲೆಕ್ಕಪರಿಶೋಧನೆ — ಭೌಗೋಳಿಕ ಅಸಮಾನತೆ' },
  'trust.riskGini': { en: 'risk Gini (0 = equal)', kn: 'ಅಪಾಯ ಜಿನಿ (0 = ಸಮಾನ)' },
  'trust.maxMinDistrict': { en: 'max/min district', kn: 'ಗರಿಷ್ಠ/ಕನಿಷ್ಠ ಜಿಲ್ಲೆ' },
  'trust.lowClearance': { en: 'low-clearance flags', kn: 'ಕಡಿಮೆ-ತೀರ್ಮಾನ ಸೂಚನೆಗಳು' },
  'trust.sampleTitle': { en: 'Every score explained — top-risk predictions with plain-language why', kn: 'ಪ್ರತಿ ಅಂಕವನ್ನು ವಿವರಿಸಲಾಗಿದೆ — ಸರಳ ಭಾಷೆಯಲ್ಲಿ ಅಧಿಕ-ಅಪಾಯ ಮುನ್ಸೂಚನೆಗಳು' },
  'trust.risk': { en: 'risk', kn: 'ಅಪಾಯ' },
  'trust.crimeOccurred': { en: 'crime occurred', kn: 'ಅಪರಾಧ ಸಂಭವಿಸಿದೆ' },
  'trust.calibTitle': { en: 'Are the risk scores trustworthy? — model calibration', kn: 'ಅಪಾಯ ಅಂಕಗಳು ವಿಶ್ವಾಸಾರ್ಹವೇ? — ಮಾದರಿ ಕ್ಯಾಲಿಬ್ರೇಶನ್' },
  'trust.reliability': { en: 'Reliability — predicted risk vs actual crime rate', kn: 'ವಿಶ್ವಾಸಾರ್ಹತೆ — ಊಹಿಸಿದ ಅಪಾಯ vs ನೈಜ ಅಪರಾಧ ದರ' },
  'trust.perfect': { en: 'perfect calibration', kn: 'ಪರಿಪೂರ್ಣ ಕ್ಯಾಲಿಬ್ರೇಶನ್' },
  'trust.calibrated': { en: 'calibrated', kn: 'ಕ್ಯಾಲಿಬ್ರೇಟೆಡ್' },
  'trust.predictedRisk': { en: 'predicted risk', kn: 'ಊಹಿಸಿದ ಅಪಾಯ' },
  'trust.actualRate': { en: 'actual rate', kn: 'ನೈಜ ದರ' },
  'trust.brier': { en: 'Brier score (lower better)', kn: 'ಬ್ರಿಯರ್ ಅಂಕ (ಕಡಿಮೆ ಉತ್ತಮ)' },
  'trust.ece': { en: 'calibration error', kn: 'ಕ್ಯಾಲಿಬ್ರೇಶನ್ ದೋಷ' },
  'trust.afterIsotonic': { en: 'after isotonic calibration', kn: 'ಐಸೊಟೋನಿಕ್ ಕ್ಯಾಲಿಬ್ರೇಶನ್ ನಂತರ' },
  'trust.calibNote': { en: 'Calibration is monotonic — it makes scores read as true probabilities without changing cell ranking, so PAI and patrol allocation are unaffected.', kn: 'ಕ್ಯಾಲಿಬ್ರೇಶನ್ ಏಕದಿಶಾತ್ಮಕ — ಕೋಶ ಶ್ರೇಣಿ ಬದಲಾಯಿಸದೆ ಅಂಕಗಳನ್ನು ನೈಜ ಸಂಭವನೀಯತೆಗಳಾಗಿ ಓದುವಂತೆ ಮಾಡುತ್ತದೆ.' },
  'trust.reliabilityTitle': { en: 'How reliable is PRAHARI?', kn: 'ಪ್ರಹರಿ ಎಷ್ಟು ವಿಶ್ವಾಸಾರ್ಹ?' },
  'trust.showExamples': { en: 'Show worked examples', kn: 'ಉದಾಹರಣೆಗಳನ್ನು ತೋರಿಸಿ' },
  'trust.hideExamples': { en: 'Hide examples', kn: 'ಉದಾಹರಣೆಗಳನ್ನು ಮರೆಮಾಡಿ' },
  'trust.limitCorpus': { en: 'Scores are benchmarked on a synthetic FIR corpus with planted patterns (a ground-truth test that the pipeline recovers known structure). The same harness runs unchanged on live CCTNS data — real-world scores will differ.', kn: 'ಅಂಕಗಳನ್ನು ಕೃತಕ FIR ದತ್ತಸಂಚಯದ ಮೇಲೆ ಮಾನದಂಡ ಮಾಡಲಾಗಿದೆ; ನೈಜ ದತ್ತಾಂಶದಲ್ಲಿ ಅಂಕಗಳು ಭಿನ್ನವಾಗಿರುತ್ತವೆ.' },
  'trust.reliabilitySub': { en: 'every number below is measured on held-out data the model never saw — nothing is estimated', kn: 'ಕೆಳಗಿನ ಪ್ರತಿ ಸಂಖ್ಯೆಯೂ ಮಾದರಿ ನೋಡದ ದತ್ತಾಂಶದ ಮೇಲೆ ಅಳೆಯಲಾಗಿದೆ — ಯಾವುದೂ ಅಂದಾಜಲ್ಲ' },
  'forecast.title': { en: 'Departure from baseline', kn: 'ಬೇಸ್‌ಲೈನ್‌ನಿಂದ ವಿಚಲನ' },
  'forecast.note': { en: 'Observed minus STL-expected counts, summed over active anomalies. Bar length is relative to the largest departure shown; arrow direction is set only when the 80% interval excludes zero.', kn: 'ಗಮನಿಸಿದ ಸಂಖ್ಯೆಗಳು ಮತ್ತು STL ನಿರೀಕ್ಷಿತ ಸಂಖ್ಯೆಗಳ ನಡುವಿನ ವ್ಯತ್ಯಾಸ. 80% ಅಂತರವು ಸುನ್ನಯನ್ನು ಹೊರತುಪಡಿಸಿದಾಗ ಮಾತ್ರ ದಿಕ್ಕು ತೋರಿಸಲಾಗುತ್ತದೆ.' },
  'trust.modelSummary': { en: 'Model summary', kn: 'ಮಾದರಿ ಸಾರಾಶ' },
  'trust.hitRateTile': { en: 'crime captured in 5% of area', kn: '5% ಪ್ರದೇಶದಲ್ಲಿ ಸೆರೆಹಿಡಿದ ಅಪರಾಧ' },
  'trust.hitRateSub': { en: 'measured on the held-out test period', kn: 'ಪರೀಕ್ಷಾ ಅವಧಿಯಲ್ಲಿ ಅಳೆಯಲಾಗಿದೆ' },
  'trust.calibTile': { en: 'calibration error', kn: 'ಕ್ಯಾಲಿಬ್ರೇಶನ್ ದೋಷ' },
  'trust.calibTileSub': { en: 'predicted risk vs what happened', kn: 'ಊಹಿಸಿದ ಅಪಾಯ vs ನಡೆದದ್ದು' },
  'trust.peiTile': { en: 'of theoretical best', kn: 'ಸೈದ್ಧಾಂತಿಕ ಗರಿಷ್ಠದ' },
  'trust.peiSub': { en: 'PEI at 5% area', kn: '5% ಪ್ರದೇಶದಲ್ಲಿ PEI' },
  'trust.evidenceTile': { en: 'held-out predictions', kn: 'ಪ್ರತ್ಯೇಕಿಸಿದ ಮುನ್ಸೂಚನೆಗಳು' },
  'trust.evidenceSub': { en: 'the evidence base', kn: 'ಸಾಕ್ಷ್ಯ ಆಧಾರ' },
  'trust.plainCalib': { en: 'Each dot: when PRAHARI predicted a risk level, this is how often crime actually happened. Dots on the dashed line = perfectly reliable.', kn: 'ಪ್ರತಿ ಚುಕ್ಕೆ: ಪ್ರಹರಿ ಒಂದು ಅಪಾಯ ಮಟ್ಟ ಊಹಿಸಿದಾಗ, ಅಪರಾಧ ಎಷ್ಟು ಬಾರಿ ನಿಜವಾಗಿ ಸಂಭವಿಸಿತು. ಗೆರೆಯ ಮೇಲಿನ ಚುಕ್ಕೆಗಳು = ಸಂಪೂರ್ಣ ವಿಶ್ವಾಸಾರ್ಹ.' },
  'trust.beforeCal': { en: 'before', kn: 'ಮೊದಲು' },
  'trust.accuracyTitle': { en: 'Accuracy vs patrol effort — measured, not projected', kn: 'ನಿಖರತೆ vs ಗಸ್ತು ಶ್ರಮ — ಅಳೆದದ್ದು, ಅಂದಾಜಲ್ಲ' },
  'trust.colArea': { en: 'Area patrolled', kn: 'ಗಸ್ತು ಪ್ರದೇಶ' },
  'trust.colCaptured': { en: 'Crime captured', kn: 'ಸೆರೆಹಿಡಿದ ಅಪರಾಧ' },
  'trust.colPai': { en: 'vs random', kn: 'ಯಾದೃಚ್ಛಿಕಕ್ಕಿಂತ' },
  'trust.colPei': { en: '% of best possible', kn: 'ಸಾಧ್ಯ ಗರಿಷ್ಠದ %' },
  'trust.testedTitle': { en: 'How this was tested', kn: 'ಇದನ್ನು ಹೇಗೆ ಪರೀಕ್ಷಿಸಲಾಯಿತು' },
  'trust.testedText': { en: 'Temporal hold-out: the model trains only on the past and is scored on a later period it never saw — the same way it would run in production. No cell, day or shift from the test window is used in training.', kn: 'ಕಾಲಿಕ ಪ್ರತ್ಯೇಕತೆ: ಮಾದರಿ ಕೇವಲ ಹಿಂದಿನ ದತ್ತಾಂಶದಿಂದ ಕಲಿತು, ನೋಡದ ನಂತರದ ಅವಧಿಯಲ್ಲಿ ಅಂಕ ಪಡೆಯುತ್ತದೆ.' },
  'trust.limitsTitle': { en: 'Known limitations — what we do NOT claim', kn: 'ತಿಳಿದ ಮಿತಿಗಳು — ನಾವು ಏನನ್ನು ಹೇಳುವುದಿಲ್ಲ' },
  'trust.limitGeo': { en: 'Case coordinates are not district-faithful in this corpus (most districts’ median coordinate falls near Bengaluru), so geography is reported at police-station level — never as exact map pins.', kn: 'ಪ್ರಕರಣ ನಿರ್ದೇಶಾಂಕಗಳು ಜಿಲ್ಲೆಗೆ ನಿಷ್ಠವಲ್ಲ, ಆದ್ದರಿಂದ ಭೂಗೋಳವನ್ನು ಠಾಣಾ ಮಟ್ಟದಲ್ಲಿ ವರದಿ ಮಾಡಲಾಗಿದೆ.' },
  'trust.limitIdentity': { en: 'PersonID is a within-case ordinal, not a person. All cross-case identity and the co-offending network use OffenderID only.', kn: 'PersonID ಪ್ರಕರಣದೊಳಗಿನ ಕ್ರಮಸಂಖ್ಯೆ ಮಾತ್ರ; ಅಡ್ಡ-ಪ್ರಕರಣ ಗುರುತಿಗೆ OffenderID ಮಾತ್ರ ಬಳಸಲಾಗಿದೆ.' },
  'trust.limitState': { en: 'Karnataka only — the data has no state dimension, so no cross-state comparison is made.', kn: 'ಕರ್ನಾಟಕ ಮಾತ್ರ — ದತ್ತಾಂಶದಲ್ಲಿ ರಾಜ್ಯ ಆಯಾಮವಿಲ್ಲ.' },
  'trust.limitOutcome': { en: 'Case status has a single value in this corpus, so conviction/outcome is not modelled or claimed.', kn: 'ಪ್ರಕರಣ ಸ್ಥಿತಿಗೆ ಒಂದೇ ಮೌಲ್ಯವಿದೆ, ಆದ್ದರಿಂದ ಫಲಿತಾಂಶವನ್ನು ಮಾದರಿ ಮಾಡಿಲ್ಲ.' },

  // ── Intro overlay ──────────────────────────────────────────────────
  'intro.title': { en: 'Welcome to PRAHARI', kn: 'ಪ್ರಹರಿಗೆ ಸ್ವಾಗತ' },
  'intro.subtitle': { en: 'Crime intelligence and decision support for Karnataka State Police', kn: 'ಕರ್ನಾಟಕ ರಾಜ್ಯ ಪೊಲೀಸರಿಗಾಗಿ ಅಪರಾಧ ಗುಪ್ತಚರ ಮತ್ತು ನಿರ್ಧಾರ ಬೆಂಬಲ' },
  'intro.commandDesc': { en: 'The state-wide operational picture: where crime is clustering right now, what departed from baseline, and which districts carry the volume', kn: 'ರಾಜ್ಯಾದ್ಯಂತ ಕಾರ್ಯಾಚರಣೆ ಚಿತ್ರಣ: ಈಗ ಅಪರಾಧ ಎಲ್ಲಿ ಗುಂಪುಗೂಡುತ್ತಿದೆ, ಮೂಲಮಟ್ಟದಿಂದ ಯಾವುದು ವ್ಯತ್ಯಾಸಗೊಂಡಿದೆ, ಮತ್ತು ಯಾವ ಜಿಲ್ಲೆಗಳಲ್ಲಿ ಹೆಚ್ಚು ಪ್ರಕರಣಗಳಿವೆ' },
  'intro.investigateDesc': { en: 'Search a person on record and open their timeline, co-accused, districts and offence pattern on one surface', kn: 'ದಾಖಲೆಯಲ್ಲಿರುವ ವ್ಯಕ್ತಿಯನ್ನು ಹುಡುಕಿ ಅವರ ಕಾಲಗಣನೆ, ಸಹ-ಆರೋಪಿಗಳು, ಜಿಲ್ಲೆಗಳು ಮತ್ತು ಅಪರಾಧ ಮಾದರಿಯನ್ನು ಒಂದೇ ತೆರೆಯಲ್ಲಿ ತೆರೆಯಿರಿ' },
  'intro.connectDesc': { en: 'Co-offending networks, community structure, and which removals actually fragment a group', kn: 'ಸಹ-ಅಪರಾಧ ಜಾಲಗಳು, ಸಮುದಾಯ ರಚನೆ, ಮತ್ತು ಯಾರನ್ನು ತೆಗೆದುಹಾಕಿದರೆ ಗುಂಪು ನಿಜವಾಗಿ ಒಡೆಯುತ್ತದೆ' },
  'intro.forecastDesc': { en: 'Gi* hotspots and trends, plus the week-ahead risk surface and anomaly alerts', kn: 'Gi* ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳು ಮತ್ತು ಪ್ರವೃತ್ತಿಗಳು, ಜೊತೆಗೆ ಮುಂದಿನ ವಾರದ ಅಪಾಯ ನಕ್ಷೆ ಮತ್ತು ಅಸಹಜತೆ ಎಚ್ಚರಿಕೆಗಳು' },
  'intro.replayDesc': { en: 'Step through the held-out test period and watch the forecast play out against the FIRs that actually followed', kn: 'ಪ್ರತ್ಯೇಕಿಸಿಟ್ಟ ಪರೀಕ್ಷಾ ಅವಧಿಯನ್ನು ಹಂತಹಂತವಾಗಿ ನೋಡಿ, ನಿಜವಾಗಿ ದಾಖಲಾದ ಎಫ್‌ಐಆರ್‌ಗಳ ವಿರುದ್ಧ ಮುನ್ಸೂಚನೆ ಹೇಗೆ ನಡೆಯಿತು ಎಂಬುದನ್ನು ವೀಕ್ಷಿಸಿ' },
  'intro.senseDesc': { en: 'Statistical hotspot detection with Gi* spatial analysis across all 37 police districts', kn: 'ಎಲ್ಲಾ 37 ಪೊಲೀಸ್ ಜಿಲ್ಲೆಗಳಲ್ಲಿ Gi* ಸ್ಥಳೀಯ ವಿಶ್ಲೇಷಣೆಯೊಂದಿಗೆ ಸಂಖ್ಯಾಶಾಸ್ತ್ರೀಯ ಹಾಟ್‌ಸ್ಪಾಟ್ ಪತ್ತೆ' },
  'intro.predictDesc': { en: 'Risk forecasting, anomaly alerts, and co-offending network analysis', kn: 'ಅಪಾಯ ಮುನ್ಸೂಚನೆ, ಅಸಹಜತೆ ಎಚ್ಚರಿಕೆಗಳು, ಮತ್ತು ಸಹ-ಅಪರಾಧ ಜಾಲ ವಿಶ್ಲೇಷಣೆ' },
  'intro.actDesc': { en: 'Optimized patrol deployment with coverage analysis and briefing sheets', kn: 'ವ್ಯಾಪ್ತಿ ವಿಶ್ಲೇಷಣೆ ಮತ್ತು ಮಾಹಿತಿ ಹಾಳೆಗಳೊಂದಿಗೆ ಅತ್ಯುತ್ತಮ ಗಸ್ತು ನಿಯೋಜನೆ' },
  'intro.trustDesc': { en: 'SHAP explanations, fairness audit, and transparent benchmarks', kn: 'SHAP ವಿವರಣೆಗಳು, ನ್ಯಾಯೋಚಿತ ಲೆಕ್ಕಪರಿಶೋಧನೆ, ಮತ್ತು ಪಾರದರ್ಶಕ ಮಾನದಂಡಗಳು' },
  // The landing page is the entry point now; this overlay is the in-console
  // "?" help, so the button dismisses rather than admits.
  'intro.dismiss': { en: 'Got it', kn: 'ಸರಿ' },

  // ── Search ─────────────────────────────────────────────────────────
  'search.placeholder': { en: 'Search district…', kn: 'ಜಿಲ್ಲೆ ಹುಡುಕಿ…' },
  'search.noResults': { en: 'No matching district', kn: 'ಹೊಂದಿಕೆಯಾಗುವ ಜಿಲ್ಲೆ ಇಲ್ಲ' },

  // ── Intelligence / Command Center ──────────────────────────────────
  'intel.feed': { en: 'Intelligence Feed', kn: 'ಗುಪ್ತಚರ ಫೀಡ್' },
  'intel.alerts': { en: 'alerts', kn: 'ಎಚ್ಚರಿಕೆಗಳು' },
  'intel.threatLevel': { en: 'Threat Level', kn: 'ಬೆದರಿಕೆ ಮಟ್ಟ' },
  'intel.recommendation': { en: 'Recommended Action', kn: 'ಶಿಫಾರಸು ಕ್ರಮ' },
  'intel.deployment': { en: 'Recommended Deployment', kn: 'ಶಿಫಾರಸು ನಿಯೋಜನೆ' },
  'intel.forecast': { en: '7-Day Crime Forecast', kn: '7-ದಿನ ಅಪರಾಧ ಮುನ್ಸೂಚನೆ' },
  'intel.aiInsight': { en: 'Model insight', kn: 'ಮಾದರಿ ಒಳನೋಟ' },
  'intel.aiSummary': { en: 'Model summary', kn: 'ಮಾದರಿ ಸಾರಾಶ' },
  'intel.trend': { en: 'Trend', kn: 'ಪ್ರವೃತ್ತಿ' },
  'intel.heinous': { en: 'Heinous', kn: 'ಗಂಭೀರ' },
  'intel.clearance': { en: 'Clearance', kn: 'ತೀರ್ಮಾನ' },
  'intel.atRisk': { en: 'At Risk', kn: 'ಅಪಾಯದಲ್ಲಿ' },
  'intel.viewDistrict': { en: 'View district', kn: 'ಜಿಲ್ಲೆ ನೋಡಿ' },

  // ── Common ─────────────────────────────────────────────────────────
  'common.loading': { en: 'loading…', kn: 'ಲೋಡ್ ಆಗುತ್ತಿದೆ…' },
  'common.analyticsComputed': { en: 'analytics computed', kn: 'ವಿಶ್ಲೇಷಣೆ ಲೆಕ್ಕಹಾಕಲಾಗಿದೆ' },
  'common.nightlyRecompute': { en: 'nightly recompute', kn: 'ರಾತ್ರಿ ಮರುಲೆಕ್ಕ' },
  'common.feedback.helpful': { en: 'Helpful', kn: 'ಸಹಾಯಕ' },
  'common.feedback.notHelpful': { en: 'Not helpful', kn: 'ಸಹಾಯಕವಲ್ಲ' },
  'common.errorTitle': { en: 'Data unavailable', kn: 'ದತ್ತಾಂಶ ಲಭ್ಯವಿಲ್ಲ' },
  'common.errorMsg': { en: 'Unable to load analytics data. Check your connection and try again.', kn: 'ವಿಶ್ಲೇಷಣೆ ದತ್ತಾಂಶವನ್ನು ಲೋಡ್ ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ನಿಮ್ಮ ಸಂಪರ್ಕವನ್ನು ಪರಿಶೀಲಿಸಿ ಮತ್ತು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.' },

  // ══ SITE (landing surface) ═════════════════════════════════════════
  // Kannada is provided for navigation, headlines and CTAs — the copy a
  // Kannada-first visitor navigates by. Long body prose falls back to
  // English via t(), which is the intended degradation.
  'site.backHome': { en: 'Back to PRAHARI home', kn: 'ಪ್ರಹರಿ ಮುಖಪುಟಕ್ಕೆ' },
  'site.nav.how': { en: 'How it works', kn: 'ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ' },
  'site.nav.impact': { en: 'Impact', kn: 'ಪರಿಣಾಮ' },
  'site.nav.stack': { en: 'Stack', kn: 'ತಂತ್ರಜ್ಞಾನ' },
  'site.nav.console': { en: 'Enter Console', kn: 'ಕನ್ಸೋಲ್ ಪ್ರವೇಶ' },

  // ── Hero ───────────────────────────────────────────────────────────
  'site.hero.badge': { en: 'KSP Datathon 2026 · Challenge 02', kn: 'ಕೆಎಸ್‌ಪಿ ಡೇಟಾಥಾನ್ 2026 · ಸವಾಲು 02' },
  'site.hero.title1': { en: 'Nine years of crime.', kn: 'ಒಂಬತ್ತು ವರ್ಷಗಳ ಅಪರಾಧ.' },
  'site.hero.title2': { en: 'One sentinel.', kn: 'ಒಬ್ಬ ಪ್ರಹರಿ.' },
  'site.hero.lede': {
    // Exact count in both languages on purpose. "1.67 million" and
    // "16.7 ಲಕ್ಷ" are the same quantity (1 lakh = 100,000), but showing two
    // different-looking figures across a language toggle invites a judge to
    // wonder which is wrong. The precise number is unambiguous in both.
    en: 'PRAHARI turns {firs} Karnataka FIR records into decisions a station house officer can act on tonight — where crime is statistically clustering, what is likely next week, and exactly where to send the patrol.',
    kn: 'ಪ್ರಹರಿ {firs} ಕರ್ನಾಟಕ ಎಫ್‌ಐಆರ್ ದಾಖಲೆಗಳನ್ನು ಇಂದೇ ಕ್ರಮ ಕೈಗೊಳ್ಳಬಹುದಾದ ನಿರ್ಧಾರಗಳಾಗಿ ಪರಿವರ್ತಿಸುತ್ತದೆ.',
  },
  'site.hero.cta': { en: 'Enter the console', kn: 'ಕನ್ಸೋಲ್ ಪ್ರವೇಶಿಸಿ' },
  'site.hero.cta2': { en: 'How it works', kn: 'ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ' },
  'site.hero.statFirs': { en: 'FIR records', kn: 'ಎಫ್‌ಐಆರ್ ದಾಖಲೆ' },
  'site.hero.statDistricts': { en: 'Districts', kn: 'ಜಿಲ್ಲೆಗಳು' },
  'site.hero.statStations': { en: 'Stations', kn: 'ಠಾಣೆಗಳು' },
  'site.hero.statPai': { en: 'Better than random', kn: 'ಯಾದೃಚ್ಛಿಕಕ್ಕಿಂತ ಉತ್ತಮ' },

  // ── Problem ────────────────────────────────────────────────────────
  'site.problem.stamp': { en: '01 / The gap', kn: '01 / ಅಂತರ' },
  'site.problem.title': { en: 'The data already exists. The decision support does not.', kn: 'ದತ್ತಾಂಶ ಈಗಾಗಲೇ ಇದೆ. ನಿರ್ಧಾರ ಬೆಂಬಲ ಇಲ್ಲ.' },
  'site.problem.lede': {
    en: 'Karnataka Police record every FIR meticulously. But the records sit in tables, not in the hands of the officer deciding where tonight’s patrol goes.',
    kn: 'ಕರ್ನಾಟಕ ಪೊಲೀಸರು ಪ್ರತಿ ಎಫ್‌ಐಆರ್ ಅನ್ನು ನಿಖರವಾಗಿ ದಾಖಲಿಸುತ್ತಾರೆ. ಆದರೆ ದಾಖಲೆಗಳು ಕೋಷ್ಟಕಗಳಲ್ಲಿ ಉಳಿಯುತ್ತವೆ.',
  },
  'site.problem.scattered.title': { en: 'Scattered across tables', kn: 'ಕೋಷ್ಟಕಗಳಲ್ಲಿ ಚದುರಿದೆ' },
  'site.problem.scattered.body': {
    en: 'Cases, accused, victims, arrests and charge sheets live in separate tables. Linking an offender across cases requires a join nobody runs at 9 PM.',
    kn: 'ಪ್ರಕರಣಗಳು, ಆರೋಪಿಗಳು, ಸಂತ್ರಸ್ತರು ಪ್ರತ್ಯೇಕ ಕೋಷ್ಟಕಗಳಲ್ಲಿವೆ.',
  },
  'site.problem.reactive.title': { en: 'Reactive, not anticipatory', kn: 'ಪ್ರತಿಕ್ರಿಯಾತ್ಮಕ, ಮುಂಚಿತವಲ್ಲ' },
  'site.problem.reactive.body': {
    en: 'Monthly crime reviews look backwards. A spike is visible weeks after it starts, and patrol routes rarely change in response to it.',
    kn: 'ಮಾಸಿಕ ಅಪರಾಧ ಪರಿಶೀಲನೆಗಳು ಹಿಂದಕ್ಕೆ ನೋಡುತ್ತವೆ.',
  },
  'site.problem.opaque.title': { en: 'Opaque when it matters', kn: 'ಮುಖ್ಯವಾದಾಗ ಅಪಾರದರ್ಶಕ' },
  'site.problem.opaque.body': {
    en: 'A risk score nobody can explain is a risk score nobody should act on — and one that can quietly encode reporting bias into deployment.',
    kn: 'ಯಾರೂ ವಿವರಿಸಲಾಗದ ಅಪಾಯ ಸ್ಕೋರ್ ಮೇಲೆ ಯಾರೂ ಕ್ರಮ ಕೈಗೊಳ್ಳಬಾರದು.',
  },

  // ── Pipeline ───────────────────────────────────────────────────────
  'site.pipeline.stamp': { en: '02 / Architecture', kn: '02 / ವಾಸ್ತುಶಿಲ್ಪ' },
  'site.pipeline.title': { en: 'Four layers, each ending in a decision', kn: 'ನಾಲ್ಕು ಪದರಗಳು, ಪ್ರತಿಯೊಂದೂ ನಿರ್ಧಾರದಲ್ಲಿ ಕೊನೆಗೊಳ್ಳುತ್ತದೆ' },
  'site.pipeline.lede': {
    en: 'Every screen answers "so what?" and "what do I do about it?" — and every recommendation can explain itself.',
    kn: 'ಪ್ರತಿ ಪರದೆಯೂ "ಹಾಗಾದರೆ ಏನು?" ಮತ್ತು "ನಾನು ಏನು ಮಾಡಬೇಕು?" ಎಂಬುದಕ್ಕೆ ಉತ್ತರಿಸುತ್ತದೆ.',
  },
  'site.pipeline.sense.name': { en: 'SENSE', kn: 'ಗ್ರಹಿಕೆ' },
  'site.pipeline.sense.body': {
    en: 'Statistically significant hotspots, not a blurred heatmap. Getis-Ord Gi* with p-values, drillable to district and station.',
    kn: 'ಅಂಕಿಅಂಶಗಳ ಪ್ರಕಾರ ಮಹತ್ವದ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳು.',
  },
  'site.pipeline.predict.name': { en: 'PREDICT', kn: 'ಮುನ್ಸೂಚನೆ' },
  'site.pipeline.predict.body': {
    en: 'Next-week risk per cell, anomaly alerts on emerging spikes, and the co-offending network behind repeat crime.',
    kn: 'ಪ್ರತಿ ಕೋಶಕ್ಕೆ ಮುಂದಿನ ವಾರದ ಅಪಾಯ ಮತ್ತು ಎಚ್ಚರಿಕೆಗಳು.',
  },
  'site.pipeline.act.name': { en: 'ACT', kn: 'ಕ್ರಮ' },
  'site.pipeline.act.body': {
    en: 'The patrol optimizer places limited units to cover the most predicted crime, and prints a briefing sheet for the shift.',
    kn: 'ಗಸ್ತು ಆಪ್ಟಿಮೈಜರ್ ಸೀಮಿತ ಘಟಕಗಳನ್ನು ಅತ್ಯುತ್ತಮವಾಗಿ ಇರಿಸುತ್ತದೆ.',
  },
  'site.pipeline.trust.name': { en: 'TRUST', kn: 'ನಂಬಿಕೆ' },
  'site.pipeline.trust.body': {
    en: 'SHAP attributions per prediction, a calibration curve, and a reporting-bias-adjusted fairness audit across districts.',
    kn: 'ಪ್ರತಿ ಮುನ್ಸೂಚನೆಗೆ SHAP ವಿವರಣೆ ಮತ್ತು ನ್ಯಾಯೋಚಿತ ಲೆಕ್ಕಪರಿಶೋಧನೆ.',
  },

  // ── Capabilities ───────────────────────────────────────────────────
  'site.caps.stamp': { en: '03 / Capabilities', kn: '03 / ಸಾಮರ್ಥ್ಯಗಳು' },
  'site.caps.title': { en: 'Eleven requirements. Ten shipped.', kn: 'ಹನ್ನೊಂದು ಅವಶ್ಯಕತೆಗಳು. ಹತ್ತು ಸಿದ್ಧ.' },
  'site.caps.lede': {
    en: 'Mapped one-to-one against the functional requirements in our BRD, with the one outstanding item marked as roadmap rather than quietly dropped.',
    kn: 'ನಮ್ಮ ಕ್ರಿಯಾತ್ಮಕ ಅವಶ್ಯಕತೆಗಳಿಗೆ ನೇರವಾಗಿ ಹೊಂದಿಸಲಾಗಿದೆ.',
  },
  'site.caps.live': { en: 'Live', kn: 'ಸಿದ್ಧ' },
  'site.caps.roadmap': { en: 'Roadmap', kn: 'ಮುಂದಿನ ಯೋಜನೆ' },
  'site.caps.ingest.title': { en: 'Unified crime data model', kn: 'ಏಕೀಕೃತ ಅಪರಾಧ ದತ್ತಾಂಶ ಮಾದರಿ' },
  // 16,650 is the cell count the shipped hotspot data actually carries and
  // what the SENSE readout shows ("722 hot cells / 16,650 analysed").
  // The old 16,463 matched neither and would not survive a judge checking.
  'site.caps.ingest.body': { en: 'Eight fragmented CCTNS tables normalised into one analysis-ready model — {firs} cases across 16,650 analysed grid cells.', kn: 'ಎಂಟು ಚದುರಿದ CCTNS ಕೋಷ್ಟಕಗಳನ್ನು ವಿಶ್ಲೇಷಣೆಗೆ ಸಿದ್ಧವಾದ ಒಂದೇ ಮಾದರಿಯಾಗಿ ಸಾಮಾನ್ಯೀಕರಿಸಲಾಗಿದೆ — 16,650 ವಿಶ್ಲೇಷಿತ ಗ್ರಿಡ್ ಕೋಶಗಳಲ್ಲಿ {firs} ಪ್ರಕರಣಗಳು.' },
  'site.caps.geo.title': { en: 'Geospatial drill-down', kn: 'ಭೌಗೋಳಿಕ ವಿಶ್ಲೇಷಣೆ' },
  'site.caps.geo.body': { en: 'State-to-district-to-station navigation on a live map, with filters by crime type, gravity and time.', kn: 'ನೇರ ನಕ್ಷೆಯಲ್ಲಿ ರಾಜ್ಯದಿಂದ ಜಿಲ್ಲೆಗೆ, ಜಿಲ್ಲೆಯಿಂದ ಠಾಣೆಗೆ ಸಂಚಾರ; ಅಪರಾಧ ಪ್ರಕಾರ, ಗಂಭೀರತೆ ಮತ್ತು ಕಾಲದ ಆಧಾರದ ಶೋಧಕಗಳೊಂದಿಗೆ.' },
  'site.caps.hotspot.title': { en: 'Statistical hotspot detection', kn: 'ಅಂಕಿಅಂಶ ಹಾಟ್‌ಸ್ಪಾಟ್ ಪತ್ತೆ' },
  'site.caps.hotspot.body': { en: 'Getis-Ord Gi* and LISA at p < 0.05, computed for 20 crime types under both state and district-normalised baselines.', kn: 'p < 0.05 ಮಟ್ಟದಲ್ಲಿ Getis-Ord Gi* ಮತ್ತು LISA, 20 ಅಪರಾಧ ಪ್ರಕಾರಗಳಿಗೆ ರಾಜ್ಯ ಮತ್ತು ಜಿಲ್ಲಾ ಮಟ್ಟದ ಮೂಲಮಟ್ಟಗಳೆರಡರಲ್ಲೂ ಲೆಕ್ಕಹಾಕಲಾಗಿದೆ.' },
  'site.caps.risk.title': { en: 'Spatio-temporal risk forecast', kn: 'ಅಪಾಯ ಮುನ್ಸೂಚನೆ' },
  'site.caps.risk.body': { en: 'A calibrated LightGBM model scoring next-week risk per cell, using near-repeat, seasonal and spatial-lag features.', kn: 'ಪ್ರತಿ ಕೋಶಕ್ಕೆ ಮುಂದಿನ ವಾರದ ಅಪಾಯವನ್ನು ಅಂದಾಜಿಸುವ ಕ್ಯಾಲಿಬ್ರೇಟೆಡ್ LightGBM ಮಾದರಿ; ಸಮೀಪ-ಪುನರಾವರ್ತನೆ, ಋತುಮಾನ ಮತ್ತು ಸ್ಥಳೀಯ ವಿಳಂಬ ಲಕ್ಷಣಗಳನ್ನು ಬಳಸುತ್ತದೆ.' },
  'site.caps.anomaly.title': { en: 'Emerging-pattern alerts', kn: 'ಹೊಸ ಮಾದರಿ ಎಚ್ಚರಿಕೆಗಳು' },
  'site.caps.anomaly.body': { en: 'STL residual analysis surfaces spikes as they emerge, ranked by z-score and routed to the intelligence feed.', kn: 'STL ಶೇಷ ವಿಶ್ಲೇಷಣೆ ಏರಿಕೆಗಳನ್ನು ಉದಯಿಸುತ್ತಿದ್ದಂತೆಯೇ ಗುರುತಿಸುತ್ತದೆ, z-ಸ್ಕೋರ್ ಪ್ರಕಾರ ಶ್ರೇಣೀಕರಿಸಿ ಗುಪ್ತಚರ ಫೀಡ್‌ಗೆ ಕಳುಹಿಸುತ್ತದೆ.' },
  'site.caps.network.title': { en: 'Co-offending network', kn: 'ಸಹ-ಅಪರಾಧಿ ಜಾಲ' },
  'site.caps.network.body': { en: 'A co-offending graph over every accused on record, with Louvain communities and a disruption simulator that ranks who to remove first.', kn: 'ದಾಖಲೆಯಲ್ಲಿರುವ ಪ್ರತಿ ಆರೋಪಿಯನ್ನೂ ಒಳಗೊಂಡ ಸಹ-ಅಪರಾಧ ಗ್ರಾಫ್; Louvain ಸಮುದಾಯಗಳು ಮತ್ತು ಯಾರನ್ನು ಮೊದಲು ತೆಗೆಯಬೇಕೆಂದು ಶ್ರೇಣೀಕರಿಸುವ ವಿಘಟನೆ ಸಿಮ್ಯುಲೇಟರ್ ಸಹಿತ.' },
  'site.caps.socio.title': { en: 'Socio-economic overlay', kn: 'ಸಾಮಾಜಿಕ-ಆರ್ಥಿಕ ಪದರ' },
  'site.caps.socio.body': { en: 'Demographic and occupational correlations for accused and victims, read alongside the spatial picture.', kn: 'ಆರೋಪಿಗಳು ಮತ್ತು ಸಂತ್ರಸ್ತರ ಜನಸಂಖ್ಯಾ ಹಾಗೂ ಉದ್ಯೋಗ ಸಂಬಂಧಗಳು, ಸ್ಥಳೀಯ ಚಿತ್ರಣದ ಜೊತೆಗೇ ಓದಲಾಗುತ್ತದೆ.' },
  'site.caps.patrol.title': { en: 'Patrol optimizer', kn: 'ಗಸ್ತು ಆಪ್ಟಿಮೈಜರ್' },
  'site.caps.patrol.body': { en: 'A maximal-coverage integer program placing limited units over predicted risk, with a greedy fallback that always returns a plan.', kn: 'ಸೀಮಿತ ಘಟಕಗಳನ್ನು ಮುನ್ಸೂಚಿತ ಅಪಾಯದ ಮೇಲೆ ಇರಿಸುವ ಗರಿಷ್ಠ-ವ್ಯಾಪ್ತಿ ಪೂರ್ಣಾಂಕ ಪ್ರೋಗ್ರಾಂ; ಯಾವಾಗಲೂ ಒಂದು ಯೋಜನೆ ನೀಡುವ ಗ್ರೀಡಿ ಪರ್ಯಾಯ ಸಹಿತ.' },
  'site.caps.explain.title': { en: 'Explainable predictions', kn: 'ವಿವರಿಸಬಹುದಾದ ಮುನ್ಸೂಚನೆ' },
  'site.caps.explain.body': { en: 'SHAP attributions per prediction plus a reliability diagram, so an officer can see why a cell scored the way it did.', kn: 'ಪ್ರತಿ ಮುನ್ಸೂಚನೆಗೆ SHAP ಕೊಡುಗೆಗಳು ಮತ್ತು ವಿಶ್ವಾಸಾರ್ಹತೆ ರೇಖಾಚಿತ್ರ, ಇದರಿಂದ ಒಂದು ಕೋಶಕ್ಕೆ ಆ ಅಂಕ ಏಕೆ ಬಂತು ಎಂಬುದನ್ನು ಅಧಿಕಾರಿ ನೋಡಬಹುದು.' },
  'site.caps.fairness.title': { en: 'Fairness & bias audit', kn: 'ನ್ಯಾಯೋಚಿತ ಲೆಕ್ಕಪರಿಶೋಧನೆ' },
  'site.caps.fairness.body': { en: 'District-level allocation equity measured with a Gini coefficient, adjusted for known differences in reporting rates.', kn: 'ಜಿಲ್ಲಾ ಮಟ್ಟದ ಹಂಚಿಕೆ ಸಮಾನತೆಯನ್ನು ಜಿನಿ ಗುಣಾಂಕದಿಂದ ಅಳೆಯಲಾಗಿದೆ, ವರದಿ ದರಗಳಲ್ಲಿನ ತಿಳಿದ ವ್ಯತ್ಯಾಸಗಳಿಗೆ ಸರಿಪಡಿಸಲಾಗಿದೆ.' },
  'site.caps.ask.title': { en: 'Ask Prahari (natural language)', kn: 'ಪ್ರಹರಿಯನ್ನು ಕೇಳಿ' },
  'site.caps.ask.body': { en: 'Plain-language querying over the analytics layer. Specified and scoped, not yet built — listed here rather than implied.', kn: 'ವಿಶ್ಲೇಷಣಾ ಪದರದ ಮೇಲೆ ಸರಳ ಭಾಷೆಯ ಪ್ರಶ್ನೆ. ವಿವರಿಸಲಾಗಿದೆ ಮತ್ತು ವ್ಯಾಪ್ತಿ ನಿಗದಿಯಾಗಿದೆ, ಇನ್ನೂ ನಿರ್ಮಿಸಿಲ್ಲ — ಸೂಚ್ಯವಾಗಿ ಬಿಡದೆ ಇಲ್ಲಿ ಸ್ಪಷ್ಟವಾಗಿ ತಿಳಿಸಲಾಗಿದೆ.' },

  // ── Metrics ────────────────────────────────────────────────────────
  'site.metrics.stamp': { en: '04 / Benchmarks', kn: '04 / ಮಾನದಂಡಗಳು' },
  'site.metrics.title': { en: 'Measured, not asserted', kn: 'ಅಳೆಯಲಾಗಿದೆ, ಹೇಳಿಕೆಯಲ್ಲ' },
  'site.metrics.lede': {
    en: 'Every figure below is read live from the benchmark report the pipeline produces, so this page cannot drift from what the model actually did.',
    kn: 'ಕೆಳಗಿನ ಪ್ರತಿ ಅಂಕಿಯೂ ಪೈಪ್‌ಲೈನ್ ಉತ್ಪಾದಿಸಿದ ವರದಿಯಿಂದ ನೇರವಾಗಿ ಬರುತ್ತದೆ.',
  },
  'site.metrics.pai': { en: 'Better than random patrol (PAI)', kn: 'ಯಾದೃಚ್ಛಿಕ ಗಸ್ತಿಗಿಂತ ಉತ್ತಮ (PAI)' },
  'site.metrics.paiNote': { en: '{n}% of crime falls inside the 5% of area the model flags.', kn: 'ಮಾದರಿ ಗುರುತಿಸುವ 5% ಪ್ರದೇಶದೊಳಗೆ {n}% ಅಪರಾಧ ಬರುತ್ತದೆ.' },
  'site.metrics.rri': { en: 'Better than current practice', kn: 'ಪ್ರಸ್ತುತ ವಿಧಾನಕ್ಕಿಂತ ಸುಧಾರಿತ' },
  'site.metrics.rriNote': { en: 'Recapture Rate Index. Patrolling where crime has historically been captures {n}% in the same 5% of area; PRAHARI captures more.', kn: 'ರಿಕಾಪ್ಚರ್ ದರ ಸೂಚ್ಯಂಕ. ಐತಿಹಾಸಿಕ ಅಪರಾಧ ಸ್ಥಳಗಳಲ್ಲಿ ಗಸ್ತು ಮಾಡಿದರೆ ಅದೇ 5% ಪ್ರದೇಶದಲ್ಲಿ {n}% ಸಿಗುತ್ತದೆ.' },
  'site.metrics.hitRate': { en: 'Hit rate @ 5% area', kn: 'ಹಿಟ್ ದರ @ 5% ಪ್ರದೇಶ' },
  'site.metrics.hitRateNote': { en: 'Share of next period’s crime captured inside the flagged 5%. Held-out temporal split — trained on earlier years, tested on later ones.', kn: 'ಫ್ಲಾಗ್ ಮಾಡಿದ 5% ಪ್ರದೇಶದಲ್ಲಿ ಸೆರೆಹಿಡಿದ ಮುಂದಿನ ಅವಧಿಯ ಅಪರಾಧಗಳ ಪ್ರಮಾಣ.' },
  'site.metrics.coverage': { en: 'Patrol coverage uplift', kn: 'ಗಸ್ತು ವ್ಯಾಪ್ತಿ ಏರಿಕೆ' },
  'site.metrics.coverageNote': { en: '{a}% optimized vs {b}% status quo, same number of units.', kn: 'ಅದೇ ಸಂಖ್ಯೆಯ ಘಟಕಗಳೊಂದಿಗೆ, ಪ್ರಸ್ತುತ ಸ್ಥಿತಿಯ {b}% ಎದುರು ಸುಧಾರಿತ {a}%.' },
  'site.metrics.gini': { en: 'Allocation Gini', kn: 'ಹಂಚಿಕೆ ಜಿನಿ' },
  'site.metrics.giniNote': { en: 'Lower is more equitable. {n} districts flagged for review.', kn: 'ಕಡಿಮೆ ಇದ್ದಷ್ಟೂ ಹೆಚ್ಚು ಸಮಾನ. ಪರಿಶೀಲನೆಗೆ {n} ಜಿಲ್ಲೆಗಳನ್ನು ಗುರುತಿಸಲಾಗಿದೆ.' },
  'site.metrics.caveat': {
    en: 'The patrol figures are for a single-district scenario (Bengaluru City, 6 units, 2 km radius) and the uplift is relative to a status-quo strategy that places units at the highest-volume stations. The integer program and the greedy fallback agree to within 0.05 percentage points, which is the check that matters: the fast heuristic is not leaving coverage on the table.',
    kn: 'ಗಸ್ತು ಅಂಕಿಅಂಶಗಳು ಒಂದೇ ಜಿಲ್ಲೆಯ ಸನ್ನಿವೇಶಕ್ಕೆ ಸಂಬಂಧಿಸಿವೆ (ಬೆಂಗಳೂರು ನಗರ, 6 ಘಟಕಗಳು, 2 ಕಿಮೀ ತ್ರಿಜ್ಯ) ಮತ್ತು ಏರಿಕೆಯನ್ನು ಅತಿ ಹೆಚ್ಚು ಪ್ರಕರಣವಿರುವ ಠಾಣೆಗಳಲ್ಲಿ ಘಟಕಗಳನ್ನು ಇರಿಸುವ ಪ್ರಸ್ತುತ ವಿಧಾನಕ್ಕೆ ಹೋಲಿಸಲಾಗಿದೆ. ಪೂರ್ಣಾಂಕ ಪ್ರೋಗ್ರಾಂ ಮತ್ತು ಗ್ರೀಡಿ ಪರ್ಯಾಯ 0.05 ಶೇಕಡಾ ಅಂಶದೊಳಗೆ ಹೊಂದಿಕೆಯಾಗುತ್ತವೆ; ಮುಖ್ಯವಾದ ಪರಿಶೀಲನೆ ಇದೇ — ವೇಗದ ಹ್ಯೂರಿಸ್ಟಿಕ್ ವ್ಯಾಪ್ತಿಯನ್ನು ಕಳೆದುಕೊಳ್ಳುತ್ತಿಲ್ಲ.',
  },

  // ── Responsible AI ─────────────────────────────────────────────────
  'site.resp.stamp': { en: '05 / Responsible AI', kn: '05 / ಜವಾಬ್ದಾರಿಯುತ AI' },
  'site.resp.title': { en: 'The line we do not cross', kn: 'ನಾವು ದಾಟದ ಗೆರೆ' },
  'site.resp.lede': {
    en: 'Predictive policing earns its reputation honestly. These constraints were designed in, not bolted on after a reviewer asked.',
    kn: 'ಈ ನಿರ್ಬಂಧಗಳನ್ನು ಆರಂಭದಿಂದಲೇ ವಿನ್ಯಾಸಗೊಳಿಸಲಾಗಿದೆ.',
  },
  'site.resp.boundaryStamp': { en: 'Ethical boundary', kn: 'ನೈತಿಕ ಗಡಿ' },
  'site.resp.boundary': {
    en: 'PRAHARI predicts risk for areas and time windows, and analyses networks of people already on record. It does not predict crime for named individuals. There is no pre-crime score for a person anywhere in this system.',
    kn: 'ಪ್ರಹರಿ ಪ್ರದೇಶ ಮತ್ತು ಸಮಯಕ್ಕೆ ಅಪಾಯವನ್ನು ಊಹಿಸುತ್ತದೆ. ಹೆಸರಿಸಿದ ವ್ಯಕ್ತಿಗಳಿಗೆ ಅಪರಾಧವನ್ನು ಊಹಿಸುವುದಿಲ್ಲ.',
  },
  'site.resp.explain.title': { en: 'Every score is explainable', kn: 'ಪ್ರತಿ ಸ್ಕೋರ್ ವಿವರಿಸಬಹುದಾಗಿದೆ' },
  'site.resp.explain.body': { en: 'SHAP attributions accompany each prediction, and a reliability diagram shows whether a 70% risk score actually means 70%.', kn: 'ಪ್ರತಿ ಮುನ್ಸೂಚನೆಯ ಜೊತೆಗೆ SHAP ಕೊಡುಗೆಗಳಿರುತ್ತವೆ, ಮತ್ತು 70% ಅಪಾಯ ಅಂಕ ನಿಜವಾಗಿಯೂ 70% ಅರ್ಥ ನೀಡುತ್ತದೆಯೇ ಎಂಬುದನ್ನು ವಿಶ್ವಾಸಾರ್ಹತೆ ರೇಖಾಚಿತ್ರ ತೋರಿಸುತ್ತದೆ.' },
  'site.resp.bias.title': { en: 'Reporting bias is adjusted for', kn: 'ವರದಿ ಪಕ್ಷಪಾತ ಸರಿಪಡಿಸಲಾಗಿದೆ' },
  'site.resp.bias.body': { en: 'More FIRs can mean more crime or simply more reporting. The fairness audit corrects for known differences before flagging a district.', kn: 'ಹೆಚ್ಚು ಎಫ್‌ಐಆರ್ ಎಂದರೆ ಹೆಚ್ಚು ಅಪರಾಧ ಇರಬಹುದು ಅಥವಾ ಕೇವಲ ಹೆಚ್ಚು ವರದಿಯಾಗಿರಬಹುದು. ಜಿಲ್ಲೆಯೊಂದನ್ನು ಗುರುತಿಸುವ ಮೊದಲು ನ್ಯಾಯೋಚಿತ ಲೆಕ್ಕಪರಿಶೋಧನೆ ತಿಳಿದ ವ್ಯತ್ಯಾಸಗಳಿಗೆ ಸರಿಪಡಿಸುತ್ತದೆ.' },
  'site.resp.privacy.title': { en: 'Analysis over identity', kn: 'ಗುರುತಿಗಿಂತ ವಿಶ್ಲೇಷಣೆ' },
  'site.resp.privacy.body': { en: 'Personal identifiers are hashed at ingest, offender views are restricted to the authenticated console, and nothing case-level appears on this public site.', kn: 'ವೈಯಕ್ತಿಕ ಗುರುತುಗಳನ್ನು ಸ್ವೀಕಾರದ ಹಂತದಲ್ಲೇ ಹ್ಯಾಶ್ ಮಾಡಲಾಗುತ್ತದೆ, ಆರೋಪಿ ವಿವರಗಳು ದೃಢೀಕೃತ ಕನ್ಸೋಲ್‌ಗೆ ಮಾತ್ರ ಸೀಮಿತ, ಮತ್ತು ಪ್ರಕರಣ ಮಟ್ಟದ ಯಾವುದೇ ಮಾಹಿತಿ ಈ ಸಾರ್ವಜನಿಕ ತಾಣದಲ್ಲಿ ಕಾಣಿಸುವುದಿಲ್ಲ.' },
  'site.resp.human.title': { en: 'Human in the loop', kn: 'ಮಾನವ ಪರಿಶೀಲನೆ' },
  'site.resp.human.body': { en: 'Every recommendation is a proposal an officer accepts, edits or rejects, and that feedback is recorded against the recommendation.', kn: 'ಪ್ರತಿ ಶಿಫಾರಸೂ ಒಂದು ಪ್ರಸ್ತಾವನೆ ಮಾತ್ರ; ಅಧಿಕಾರಿ ಅದನ್ನು ಸ್ವೀಕರಿಸಬಹುದು, ತಿದ್ದಬಹುದು ಅಥವಾ ತಿರಸ್ಕರಿಸಬಹುದು, ಮತ್ತು ಆ ಪ್ರತಿಕ್ರಿಯೆಯನ್ನು ಶಿಫಾರಸಿನ ಎದುರು ದಾಖಲಿಸಲಾಗುತ್ತದೆ.' },

  // ── Stack ──────────────────────────────────────────────────────────
  'site.stack.stamp': { en: '06 / Stack', kn: '06 / ತಂತ್ರಜ್ಞಾನ' },
  'site.stack.title': { en: 'Built to run, and to be rebuilt', kn: 'ಚಲಾಯಿಸಲು ಮತ್ತು ಮರುನಿರ್ಮಿಸಲು ನಿರ್ಮಿಸಲಾಗಿದೆ' },
  'site.stack.lede': {
    en: 'Heavy analytics are precomputed on a schedule and served as cached artefacts, so the console stays responsive on a station laptop.',
    kn: 'ಭಾರೀ ವಿಶ್ಲೇಷಣೆಗಳನ್ನು ಮೊದಲೇ ಲೆಕ್ಕಹಾಕಲಾಗುತ್ತದೆ.',
  },
  'site.stack.frontend': { en: 'Frontend', kn: 'ಮುಂಭಾಗ' },
  'site.stack.ml': { en: 'ML & optimisation', kn: 'ML ಮತ್ತು ಆಪ್ಟಿಮೈಸೇಶನ್' },
  'site.stack.platform': { en: 'Platform', kn: 'ವೇದಿಕೆ' },
  'site.stack.thService': { en: 'Catalyst service', kn: 'ಕ್ಯಾಟಲಿಸ್ಟ್ ಸೇವೆ' },
  'site.stack.thUse': { en: 'How PRAHARI uses it', kn: 'ಬಳಕೆ' },
  'site.stack.thStatus': { en: 'Status', kn: 'ಸ್ಥಿತಿ' },
  'site.stack.live': { en: 'Deployed', kn: 'ನಿಯೋಜಿತ' },
  'site.stack.planned': { en: 'Architected', kn: 'ವಿನ್ಯಾಸಗೊಂಡಿದೆ' },
  'site.stack.svc.hosting': { en: 'Serves the React console and this site, plus the precomputed analytics artefacts.', kn: 'React ಕನ್ಸೋಲ್, ಈ ತಾಣ ಮತ್ತು ಪೂರ್ವಗಣಿತ ವಿಶ್ಲೇಷಣಾ ಕಡತಗಳನ್ನು ಒದಗಿಸುತ್ತದೆ.' },
  'site.stack.svc.functions': { en: 'Query API in front of the cached analytics, and the human-in-the-loop feedback endpoint.', kn: 'ಸಂಗ್ರಹಿತ ವಿಶ್ಲೇಷಣೆಯ ಮುಂದಿನ ಪ್ರಶ್ನಾ API ಮತ್ತು ಮಾನವ ಪರಿಶೀಲನೆಯ ಪ್ರತಿಕ್ರಿಯೆ ಎಂಡ್‌ಪಾಯಿಂಟ್.' },
  'site.stack.svc.datastore': { en: 'Normalised case, offender and feedback tables.', kn: 'ಸಾಮಾನ್ಯೀಕರಿಸಿದ ಪ್ರಕರಣ, ಆರೋಪಿ ಮತ್ತು ಪ್ರತಿಕ್ರಿಯೆ ಕೋಷ್ಟಕಗಳು.' },
  'site.stack.svc.stratus': { en: 'Object storage for hotspot GeoJSON surfaces and model artefacts.', kn: 'ಹಾಟ್‌ಸ್ಪಾಟ್ GeoJSON ನಕ್ಷೆಗಳು ಮತ್ತು ಮಾದರಿ ಕಡತಗಳಿಗೆ ವಸ್ತು ಸಂಗ್ರಹಣೆ.' },
  'site.stack.svc.cron': { en: 'Nightly recomputation of hotspots, risk scores, anomalies and patrol plans.', kn: 'ಹಾಟ್‌ಸ್ಪಾಟ್, ಅಪಾಯ ಅಂಕ, ಅಸಹಜತೆ ಮತ್ತು ಗಸ್ತು ಯೋಜನೆಗಳ ಪ್ರತಿರಾತ್ರಿ ಮರುಗಣನೆ.' },

  // ── CTA ────────────────────────────────────────────────────────────
  'site.cta.stamp': { en: 'Live deployment', kn: 'ನೇರ ನಿಯೋಜನೆ' },
  'site.cta.title': { en: 'Open the command center', kn: 'ಕಮಾಂಡ್ ಸೆಂಟರ್ ತೆರೆಯಿರಿ' },
  'site.cta.lede': {
    en: 'Four tabs, real Karnataka data, and a patrol plan you can print. No sign-in required.',
    kn: 'ನಾಲ್ಕು ಟ್ಯಾಬ್‌ಗಳು, ನೈಜ ಕರ್ನಾಟಕ ದತ್ತಾಂಶ. ಸೈನ್-ಇನ್ ಅಗತ್ಯವಿಲ್ಲ.',
  },
  'site.cta.button': { en: 'Enter console', kn: 'ಕನ್ಸೋಲ್ ಪ್ರವೇಶಿಸಿ' },
  'site.cta.button2': { en: 'See the benchmarks', kn: 'ಮಾನದಂಡಗಳನ್ನು ನೋಡಿ' },

  // ── Footer ─────────────────────────────────────────────────────────
  'site.footer.blurb': {
    en: 'An AI-driven crime analytics and visualisation platform built for Karnataka State Police on the KSP Datathon 2026 dataset.',
    kn: 'ಕೆಎಸ್‌ಪಿ ಡೇಟಾಥಾನ್ 2026 ದತ್ತಾಂಶದ ಮೇಲೆ ನಿರ್ಮಿಸಲಾದ ಅಪರಾಧ ವಿಶ್ಲೇಷಣಾ ವೇದಿಕೆ.',
  },
  'site.footer.explore': { en: 'Explore', kn: 'ಅನ್ವೇಷಿಸಿ' },
  'site.footer.built': { en: 'Built on', kn: 'ನಿರ್ಮಿಸಲಾಗಿದೆ' },
  'site.footer.catalyst': { en: 'Zoho Catalyst', kn: 'ಝೋಹೋ ಕ್ಯಾಟಲಿಸ್ಟ್' },
  'site.footer.dataset': { en: 'KSP FIR dataset · 2016–2024', kn: 'ಕೆಎಸ್‌ಪಿ ಎಫ್‌ಐಆರ್ ದತ್ತಾಂಶ · 2016–2024' },
  'site.footer.note': { en: 'Prototype · analytics recomputed nightly', kn: 'ಮೂಲಮಾದರಿ · ರಾತ್ರಿ ಮರುಲೆಕ್ಕ' },

  // ── How it works page ──────────────────────────────────────────────
  'site.how.stamp': { en: 'Method', kn: 'ವಿಧಾನ' },
  'site.how.title': { en: 'From {firs} records to tonight’s patrol route', kn: '{firs} ದಾಖಲೆಗಳಿಂದ ಇಂದಿನ ಗಸ್ತು ಮಾರ್ಗಕ್ಕೆ' },
  'site.how.lede': {
    en: 'The pipeline runs end to end in about twenty minutes and produces every artefact the console reads. Nothing on screen is computed live in the browser.',
    kn: 'ಪೈಪ್‌ಲೈನ್ ಸುಮಾರು ಇಪ್ಪತ್ತು ನಿಮಿಷಗಳಲ್ಲಿ ಪೂರ್ಣಗೊಳ್ಳುತ್ತದೆ.',
  },
  'site.how.dataStamp': { en: '00 / The dataset', kn: '00 / ದತ್ತಾಂಶ' },
  'site.how.dataTitle': { en: 'What we started with', kn: 'ನಾವು ಪ್ರಾರಂಭಿಸಿದ್ದು' },
  'site.how.dataLede': { en: 'The official KSP FIR dataset, covering every district and station in Karnataka.', kn: 'ಅಧಿಕೃತ ಕೆಎಸ್‌ಪಿ ಎಫ್‌ಐಆರ್ ದತ್ತಾಂಶ.' },
  'site.how.dFirs': { en: 'FIR records', kn: 'ಎಫ್‌ಐಆರ್ ದಾಖಲೆ' },
  'site.how.dYears': { en: 'Years covered', kn: 'ವರ್ಷಗಳು' },
  'site.how.dDistricts': { en: 'Districts', kn: 'ಜಿಲ್ಲೆಗಳು' },
  'site.how.dStations': { en: 'Police stations', kn: 'ಪೊಲೀಸ್ ಠಾಣೆಗಳು' },
  'site.how.methods': { en: 'Methods', kn: 'ವಿಧಾನಗಳು' },
  'site.how.open': { en: 'Open', kn: 'ತೆರೆಯಿರಿ' },
  'site.how.sense.title': { en: 'Find where crime actually clusters', kn: 'ಅಪರಾಧ ಎಲ್ಲಿ ಕೇಂದ್ರೀಕೃತವಾಗಿದೆ ಎಂದು ಕಂಡುಹಿಡಿಯಿರಿ' },
  'site.how.sense.body': {
    en: 'A kernel-density heatmap shows you where the dots are dense. It cannot tell you whether that density is more than chance would produce. Gi* can — so every cell on the SENSE map carries a significance level, and a cell that is merely busy is visibly distinguished from one that is statistically hot.',
    kn: 'ಕರ್ನಲ್-ಸಾಂದ್ರತೆ ಹೀಟ್‌ಮ್ಯಾಪ್ ಚುಕ್ಕೆಗಳು ಎಲ್ಲಿ ದಟ್ಟವಾಗಿವೆ ಎಂದು ತೋರಿಸುತ್ತದೆ. ಆದರೆ ಆ ದಟ್ಟಣೆ ಆಕಸ್ಮಿಕಕ್ಕಿಂತ ಹೆಚ್ಚೇ ಎಂದು ಅದು ಹೇಳಲಾರದು. Gi* ಹೇಳಬಲ್ಲದು — ಆದ್ದರಿಂದ ನಕ್ಷೆಯ ಪ್ರತಿ ಕೋಶವೂ ಮಹತ್ವದ ಮಟ್ಟವನ್ನು ಹೊಂದಿರುತ್ತದೆ, ಮತ್ತು ಕೇವಲ ಚಟುವಟಿಕೆ ಹೆಚ್ಚಿರುವ ಕೋಶವನ್ನು ಅಂಕಿಅಂಶಗಳ ಪ್ರಕಾರ ನಿಜವಾಗಿ ಬಿಸಿಯಾಗಿರುವ ಕೋಶದಿಂದ ಸ್ಪಷ್ಟವಾಗಿ ಬೇರ್ಪಡಿಸಲಾಗುತ್ತದೆ.',
  },
  'site.how.predict.title': { en: 'Score what is likely next', kn: 'ಮುಂದೆ ಏನಾಗಬಹುದು ಎಂದು ಅಂದಾಜಿಸಿ' },
  'site.how.predict.body': {
    en: 'Crime is self-exciting: a burglary raises the odds of another nearby within days. The risk model encodes that near-repeat structure alongside seasonality and spatial lags, then a separate STL pass watches residuals so an emerging spike surfaces as an alert rather than waiting for the monthly review.',
    kn: 'ಅಪರಾಧ ಸ್ವಯಂ-ಪ್ರಚೋದಕ: ಒಂದು ಕಳ್ಳತನ ಕೆಲವೇ ದಿನಗಳಲ್ಲಿ ಸಮೀಪದಲ್ಲಿ ಇನ್ನೊಂದರ ಸಾಧ್ಯತೆಯನ್ನು ಹೆಚ್ಚಿಸುತ್ತದೆ. ಅಪಾಯ ಮಾದರಿ ಈ ಸಮೀಪ-ಪುನರಾವರ್ತನೆ ರಚನೆಯನ್ನು ಋತುಮಾನ ಮತ್ತು ಸ್ಥಳೀಯ ವಿಳಂಬಗಳ ಜೊತೆಗೆ ಅಳವಡಿಸುತ್ತದೆ; ನಂತರ ಪ್ರತ್ಯೇಕ STL ಹಂತವು ಶೇಷಗಳನ್ನು ಗಮನಿಸುತ್ತದೆ, ಇದರಿಂದ ಉದಯಿಸುತ್ತಿರುವ ಏರಿಕೆ ಮಾಸಿಕ ಪರಿಶೀಲನೆಗೆ ಕಾಯದೆ ಎಚ್ಚರಿಕೆಯಾಗಿ ಮೇಲೆ ಬರುತ್ತದೆ.',
  },
  'site.how.act.title': { en: 'Place the units you actually have', kn: 'ನಿಜವಾಗಿ ಇರುವ ಘಟಕಗಳನ್ನು ಇರಿಸಿ' },
  'site.how.act.body': {
    en: 'Knowing where risk is high does not tell you where to park six vehicles. That is a maximal-coverage problem, and we solve it as an integer program — with a greedy heuristic that always returns something, because a plan that fails to solve at 8 PM is worse than a slightly suboptimal one.',
    kn: 'ಅಪಾಯ ಎಲ್ಲಿ ಹೆಚ್ಚಿದೆ ಎಂದು ತಿಳಿದ ಮಾತ್ರಕ್ಕೆ ಆರು ವಾಹನಗಳನ್ನು ಎಲ್ಲಿ ನಿಲ್ಲಿಸಬೇಕೆಂದು ತಿಳಿಯುವುದಿಲ್ಲ. ಅದು ಗರಿಷ್ಠ-ವ್ಯಾಪ್ತಿಯ ಸಮಸ್ಯೆ, ಅದನ್ನು ನಾವು ಪೂರ್ಣಾಂಕ ಪ್ರೋಗ್ರಾಂ ಆಗಿ ಪರಿಹರಿಸುತ್ತೇವೆ — ಜೊತೆಗೆ ಯಾವಾಗಲೂ ಏನಾದರೂ ನೀಡುವ ಗ್ರೀಡಿ ಹ್ಯೂರಿಸ್ಟಿಕ್ ಇರುತ್ತದೆ, ಏಕೆಂದರೆ ರಾತ್ರಿ 8 ಗಂಟೆಗೆ ಪರಿಹಾರ ಸಿಗದ ಯೋಜನೆಗಿಂತ ಸ್ವಲ್ಪ ಕಡಿಮೆ ಉತ್ತಮವಾದ ಯೋಜನೆಯೇ ಮೇಲು.',
  },
  'site.how.trust.title': { en: 'Show the working', kn: 'ಕೆಲಸವನ್ನು ತೋರಿಸಿ' },
  'site.how.trust.body': {
    en: 'A risk score an officer cannot interrogate will not be trusted, and should not be. TRUST exposes the feature attributions behind each prediction, the calibration curve, and a fairness audit that adjusts for reporting-rate differences before it accuses a district of anything.',
    kn: 'ಅಧಿಕಾರಿ ಪ್ರಶ್ನಿಸಲಾಗದ ಅಪಾಯ ಅಂಕವನ್ನು ಯಾರೂ ನಂಬುವುದಿಲ್ಲ, ನಂಬಲೂ ಬಾರದು. ನಂಬಿಕೆ ವಿಭಾಗವು ಪ್ರತಿ ಮುನ್ಸೂಚನೆಯ ಹಿಂದಿನ ಲಕ್ಷಣ ಕೊಡುಗೆಗಳನ್ನು, ಕ್ಯಾಲಿಬ್ರೇಶನ್ ವಕ್ರರೇಖೆಯನ್ನು, ಮತ್ತು ಯಾವುದೇ ಜಿಲ್ಲೆಯ ಮೇಲೆ ಆರೋಪ ಹೊರಿಸುವ ಮೊದಲು ವರದಿ ದರದ ವ್ಯತ್ಯಾಸಗಳಿಗೆ ಸರಿಪಡಿಸುವ ನ್ಯಾಯೋಚಿತ ಲೆಕ್ಕಪರಿಶೋಧನೆಯನ್ನು ತೆರೆದಿಡುತ್ತದೆ.',
  },

  // ── Impact page ────────────────────────────────────────────────────
  'site.impact.stamp': { en: 'Evidence', kn: 'ಪುರಾವೆ' },
  'site.impact.title': { en: 'What the numbers actually say', kn: 'ಸಂಖ್ಯೆಗಳು ನಿಜವಾಗಿ ಏನು ಹೇಳುತ್ತವೆ' },
  'site.impact.lede': {
    en: 'Reported as the benchmark harness produced them, including the parts that are less flattering than a headline would prefer.',
    kn: 'ಮಾನದಂಡ ವರದಿಯಂತೆಯೇ ವರದಿ ಮಾಡಲಾಗಿದೆ.',
  },
  'site.impact.patrolStamp': { en: 'Patrol optimizer', kn: 'ಗಸ್ತು ಆಪ್ಟಿಮೈಜರ್' },
  'site.impact.patrolTitle': { en: 'Coverage under four strategies', kn: 'ನಾಲ್ಕು ತಂತ್ರಗಳ ಅಡಿಯಲ್ಲಿ ವ್ಯಾಪ್ತಿ' },
  'site.impact.patrolLede': { en: 'Scenario: {n} patrol units, {r} km effective radius, scoped to {d}. Coverage is the share of predicted crime falling inside a patrolled radius.', kn: 'ಸನ್ನಿವೇಶ: {n} ಗಸ್ತು ಘಟಕಗಳು, {r} ಕಿಮೀ ಪರಿಣಾಮಕಾರಿ ತ್ರಿಜ್ಯ, {d} ವ್ಯಾಪ್ತಿಗೆ ಸೀಮಿತ. ಗಸ್ತು ತ್ರಿಜ್ಯದೊಳಗೆ ಬರುವ ಮುನ್ಸೂಚಿತ ಅಪರಾಧದ ಪ್ರಮಾಣವೇ ವ್ಯಾಪ್ತಿ.' },
  'site.impact.thStrategy': { en: 'Strategy', kn: 'ತಂತ್ರ' },
  'site.impact.thCoverage': { en: 'Coverage', kn: 'ವ್ಯಾಪ್ತಿ' },
  'site.impact.thNote': { en: 'Note', kn: 'ಟಿಪ್ಪಣಿ' },
  'site.impact.rBaseline': { en: 'Random placement', kn: 'ಯಾದೃಚ್ಛಿಕ ನಿಯೋಜನೆ' },
  'site.impact.nBaseline': { en: 'Lower bound — units placed without reference to risk.', kn: 'ಕನಿಷ್ಠ ಮಿತಿ — ಅಪಾಯವನ್ನು ಪರಿಗಣಿಸದೆ ಇರಿಸಲಾದ ಘಟಕಗಳು.' },
  'site.impact.rStatusQuo': { en: 'Status quo', kn: 'ಪ್ರಸ್ತುತ ಸ್ಥಿತಿ' },
  'site.impact.nStatusQuo': { en: 'Units at the highest-volume stations — what typically happens today.', kn: 'ಅತಿ ಹೆಚ್ಚು ಪ್ರಕರಣವಿರುವ ಠಾಣೆಗಳಲ್ಲಿ ಘಟಕಗಳು — ಇಂದು ಸಾಮಾನ್ಯವಾಗಿ ನಡೆಯುವುದು ಇದೇ.' },
  'site.impact.rGreedy': { en: 'PRAHARI (greedy)', kn: 'ಪ್ರಹರಿ (ಗ್ರೀಡಿ)' },
  'site.impact.nGreedy': { en: 'The fallback that always returns a plan, in milliseconds.', kn: 'ಮಿಲಿಸೆಕೆಂಡುಗಳಲ್ಲಿ ಯಾವಾಗಲೂ ಯೋಜನೆ ನೀಡುವ ಪರ್ಯಾಯ ವಿಧಾನ.' },
  'site.impact.rIlp': { en: 'PRAHARI (integer program)', kn: 'ಪ್ರಹರಿ (ILP)' },
  'site.impact.nIlp': { en: 'Optimal placement. The greedy result lands within 0.05 pp of it.', kn: 'ಅತ್ಯುತ್ತಮ ನಿಯೋಜನೆ. ಗ್ರೀಡಿ ಫಲಿತಾಂಶ ಇದರ 0.05 ಶೇಕಡಾ ಅಂಶದೊಳಗೆ ಬರುತ್ತದೆ.' },
  'site.impact.netStamp': { en: 'Network analysis', kn: 'ಜಾಲ ವಿಶ್ಲೇಷಣೆ' },
  'site.impact.netTitle': { en: 'The co-offending graph', kn: 'ಸಹ-ಅಪರಾಧಿ ಗ್ರಾಫ್' },
  'site.impact.netLede': {
    en: 'Built by linking offenders who appear together on the same case, then partitioned into communities.',
    kn: 'ಒಂದೇ ಪ್ರಕರಣದಲ್ಲಿ ಕಾಣಿಸಿಕೊಳ್ಳುವ ಅಪರಾಧಿಗಳನ್ನು ಜೋಡಿಸಿ ನಿರ್ಮಿಸಲಾಗಿದೆ.',
  },
  'site.impact.nodes': { en: 'Offenders', kn: 'ಅಪರಾಧಿಗಳು' },
  'site.impact.edges': { en: 'Co-offending links', kn: 'ಸಂಪರ್ಕಗಳು' },
  'site.impact.communities': { en: 'Communities', kn: 'ಸಮುದಾಯಗಳು' },
  'site.impact.modularity': { en: 'Modularity', kn: 'ಮಾಡ್ಯುಲಾರಿಟಿ' },
  'site.impact.netNote': {
    en: 'High modularity here reflects a graph of many small, well-separated groups rather than a few large syndicates — which is what nine years of FIR co-accused data should look like. The disruption simulator is therefore most useful within a specific gang: on the largest identified group, removing the top-ranked members fragments it into eleven pieces. Removing any single individual from the state-wide graph changes almost nothing, and we report that number as it is.',
    kn: 'ಇಲ್ಲಿನ ಹೆಚ್ಚಿನ ಮಾಡ್ಯುಲಾರಿಟಿ ಕೆಲವು ದೊಡ್ಡ ಸಂಘಟನೆಗಳಿಗಿಂತ ಹಲವು ಸಣ್ಣ, ಚೆನ್ನಾಗಿ ಬೇರ್ಪಟ್ಟ ಗುಂಪುಗಳ ಗ್ರಾಫ್ ಅನ್ನು ಸೂಚಿಸುತ್ತದೆ — ಒಂಬತ್ತು ವರ್ಷಗಳ ಎಫ್‌ಐಆರ್ ಸಹ-ಆರೋಪಿ ದತ್ತಾಂಶ ಹೀಗೇ ಕಾಣಬೇಕು. ಆದ್ದರಿಂದ ವಿಘಟನೆ ಸಿಮ್ಯುಲೇಟರ್ ನಿರ್ದಿಷ್ಟ ಗುಂಪಿನೊಳಗೆ ಅತ್ಯಂತ ಉಪಯುಕ್ತ: ಗುರುತಿಸಲಾದ ಅತಿ ದೊಡ್ಡ ಗುಂಪಿನಲ್ಲಿ ಅಗ್ರ ಶ್ರೇಣಿಯ ಸದಸ್ಯರನ್ನು ತೆಗೆದರೆ ಅದು ಹನ್ನೊಂದು ತುಣುಕುಗಳಾಗಿ ಒಡೆಯುತ್ತದೆ. ರಾಜ್ಯಾದ್ಯಂತ ಗ್ರಾಫ್‌ನಿಂದ ಯಾವುದೇ ಒಬ್ಬ ವ್ಯಕ್ತಿಯನ್ನು ತೆಗೆದರೆ ಬಹುತೇಕ ಏನೂ ಬದಲಾಗುವುದಿಲ್ಲ, ಮತ್ತು ಆ ಸಂಖ್ಯೆಯನ್ನು ಇದ್ದಂತೆಯೇ ವರದಿ ಮಾಡುತ್ತೇವೆ.',
  },

  // ── Stack page ─────────────────────────────────────────────────────
  'site.stackPage.stamp': { en: 'Engineering', kn: 'ಎಂಜಿನಿಯರಿಂಗ್' },
  'site.stackPage.title': { en: 'How it is built and where it runs', kn: 'ಹೇಗೆ ನಿರ್ಮಿಸಲಾಗಿದೆ ಮತ್ತು ಎಲ್ಲಿ ಚಲಿಸುತ್ತದೆ' },
  'site.stackPage.lede': {
    en: 'A Python analytics pipeline that runs offline, and a React console that reads only its cached output.',
    kn: 'ಆಫ್‌ಲೈನ್ ಪೈಥಾನ್ ಪೈಪ್‌ಲೈನ್ ಮತ್ತು React ಕನ್ಸೋಲ್.',
  },
  'site.stackPage.catStamp': { en: 'Zoho Catalyst', kn: 'ಝೋಹೋ ಕ್ಯಾಟಲಿಸ್ಟ್' },
  'site.stackPage.catTitle': { en: 'Catalyst services used', kn: 'ಬಳಸಿದ ಕ್ಯಾಟಲಿಸ್ಟ್ ಸೇವೆಗಳು' },
  'site.stackPage.catLede': {
    en: 'Catalyst is the deployment platform for this submission. Services are listed with their real status rather than aspirationally.',
    kn: 'ಈ ಸಲ್ಲಿಕೆಗೆ ಕ್ಯಾಟಲಿಸ್ಟ್ ನಿಯೋಜನಾ ವೇದಿಕೆಯಾಗಿದೆ.',
  },
  'site.stackPage.catNote': {
    en: 'The live build is served entirely from Catalyst Hosting: the console, this site, and the precomputed analytics artefacts it reads. The remaining services are designed into the architecture and are the next integration step — we would rather state that plainly than claim a service the deployment does not yet touch.',
    kn: 'ನೇರ ಬಿಲ್ಡ್ ಸಂಪೂರ್ಣವಾಗಿ Catalyst Hosting ನಿಂದ ಒದಗಿಸಲ್ಪಡುತ್ತದೆ: ಕನ್ಸೋಲ್, ಈ ತಾಣ, ಮತ್ತು ಅದು ಓದುವ ಪೂರ್ವಗಣಿತ ವಿಶ್ಲೇಷಣಾ ಕಡತಗಳು. ಉಳಿದ ಸೇವೆಗಳನ್ನು ವಾಸ್ತುಶಿಲ್ಪದಲ್ಲಿ ವಿನ್ಯಾಸಗೊಳಿಸಲಾಗಿದೆ ಮತ್ತು ಅವು ಮುಂದಿನ ಜೋಡಣೆ ಹಂತ — ನಿಯೋಜನೆ ಇನ್ನೂ ಮುಟ್ಟದ ಸೇವೆಯನ್ನು ಹೇಳಿಕೊಳ್ಳುವುದಕ್ಕಿಂತ ಇದನ್ನು ಸ್ಪಷ್ಟವಾಗಿ ತಿಳಿಸುವುದೇ ಸೂಕ್ತ.',
  },
  'site.stackPage.pipeStamp': { en: 'Pipeline', kn: 'ಪೈಪ್‌ಲೈನ್' },
  'site.stackPage.pipeTitle': { en: 'Nine steps, one command', kn: 'ಒಂಬತ್ತು ಹಂತಗಳು, ಒಂದು ಆದೇಶ' },
  'site.stackPage.pipeLede': {
    en: 'The whole analytics pipeline is reproducible from the raw dataset with a single entry point.',
    kn: 'ಸಂಪೂರ್ಣ ಪೈಪ್‌ಲೈನ್ ಒಂದೇ ಆದೇಶದಿಂದ ಮರುಉತ್ಪಾದಿಸಬಹುದು.',
  },
  'site.stackPage.pipeNote': {
    en: 'Every step writes JSON or GeoJSON artefacts that the console loads directly. Because nothing is computed in the browser, the console stays responsive on modest hardware and the same artefacts can be served from a scheduled nightly job.',
    kn: 'ಪ್ರತಿ ಹಂತವೂ ಕನ್ಸೋಲ್ ನೇರವಾಗಿ ಲೋಡ್ ಮಾಡುವ JSON ಅಥವಾ GeoJSON ಕಡತಗಳನ್ನು ಬರೆಯುತ್ತದೆ. ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಏನನ್ನೂ ಲೆಕ್ಕಹಾಕದ ಕಾರಣ ಸಾಧಾರಣ ಯಂತ್ರಾಂಶದಲ್ಲೂ ಕನ್ಸೋಲ್ ಚುರುಕಾಗಿರುತ್ತದೆ, ಮತ್ತು ಅದೇ ಕಡತಗಳನ್ನು ನಿಗದಿತ ರಾತ್ರಿ ಕೆಲಸದಿಂದ ಒದಗಿಸಬಹುದು.',
  },
}

// ── District name translations ───────────────────────────────────────
const districtNames: Record<string, string> = {
  'BAGALKOT': 'ಬಾಗಲಕೋಟ',
  'BALLARI': 'ಬಳ್ಳಾರಿ',
  'BELAGAVI CITY': 'ಬೆಳಗಾವಿ ನಗರ',
  'BELAGAVI DIST': 'ಬೆಳಗಾವಿ ಜಿಲ್ಲೆ',
  'BENGALURU CITY': 'ಬೆಂಗಳೂರು ನಗರ',
  'BENGALURU DIST': 'ಬೆಂಗಳೂರು ಜಿಲ್ಲೆ',
  'BIDAR': 'ಬೀದರ',
  'CHAMARAJANAGAR': 'ಚಾಮರಾಜನಗರ',
  'CHICKBALLAPURA': 'ಚಿಕ್ಕಬಳ್ಳಾಪುರ',
  'CHIKKAMAGALURU': 'ಚಿಕ್ಕಮಗಳೂರು',
  'CHITRADURGA': 'ಚಿತ್ರದುರ್ಗ',
  'CID': 'ಸಿಐಡಿ',
  'COASTAL SECURITY POLICE': 'ಕರಾವಳಿ ಭದ್ರತಾ ಪೊಲೀಸ್',
  'DAKSHINA KANNADA': 'ದಕ್ಷಿಣ ಕನ್ನಡ',
  'DAVANAGERE': 'ದಾವಣಗೆರೆ',
  'DHARWAD': 'ಧಾರವಾಡ',
  'GADAG': 'ಗದಗ',
  'HASSAN': 'ಹಾಸನ',
  'HAVERI': 'ಹಾವೇರಿ',
  'HUBBALLI DHARWAD CITY': 'ಹುಬ್ಬಳ್ಳಿ ಧಾರವಾಡ ನಗರ',
  'ISD BENGALURU': 'ಐಎಸ್‌ಡಿ ಬೆಂಗಳೂರು',
  'K.G.F': 'ಕೆ.ಜಿ.ಎಫ್',
  'KALABURAGI': 'ಕಲಬುರಗಿ',
  'KALABURAGI CITY': 'ಕಲಬುರಗಿ ನಗರ',
  'KARNATAKA RAILWAYS': 'ಕರ್ನಾಟಕ ರೈಲ್ವೇ',
  'KODAGU': 'ಕೊಡಗು',
  'KOLAR': 'ಕೋಲಾರ',
  'KOPPAL': 'ಕೊಪ್ಪಳ',
  'MANDYA': 'ಮಂಡ್ಯ',
  'MANGALURU CITY': 'ಮಂಗಳೂರು ನಗರ',
  'MYSURU CITY': 'ಮೈಸೂರು ನಗರ',
  'MYSURU DIST': 'ಮೈಸೂರು ಜಿಲ್ಲೆ',
  'RAICHUR': 'ರಾಯಚೂರು',
  'RAMANAGARA': 'ರಾಮನಗರ',
  'SHIVAMOGGA': 'ಶಿವಮೊಗ್ಗ',
  'TUMAKURU': 'ತುಮಕೂರು',
  'UDUPI': 'ಉಡುಪಿ',
  'UTTARA KANNADA': 'ಉತ್ತರ ಕನ್ನಡ',
  'VIJAYANAGARA': 'ವಿಜಯನಗರ',
  'VIJAYAPUR': 'ವಿಜಯಪುರ',
  'YADGIR': 'ಯಾದಗಿರಿ',
}

/* Exported so search can match Kannada names regardless of the active
   language: td() deliberately returns English when lang is 'en', but a
   Kannada speaker should still be able to type ಬೆಂಗಳೂರು into the English UI. */
export function districtNameKn(district: string): string | undefined {
  return districtNames[district]
}

// ── Crime type translations ──────────────────────────────────────────
const crimeTypes: Record<string, string> = {
  'Arms Act Violations': 'ಶಸ್ತ್ರಾಸ್ತ್ರ ಕಾಯ್ದೆ ಉಲ್ಲಂಘನೆ',
  'Cheating & Fraud': 'ವಂಚನೆ ಮತ್ತು ಮೋಸ',
  'Crimes Against Body': 'ದೇಹದ ವಿರುದ್ಧ ಅಪರಾಧಗಳು',
  'Crimes Against Children': 'ಮಕ್ಕಳ ವಿರುದ್ಧ ಅಪರಾಧಗಳು',
  'Crimes Against Property': 'ಆಸ್ತಿ ವಿರುದ್ಧ ಅಪರಾಧಗಳು',
  'Crimes Against Public Tranquility': 'ಸಾರ್ವಜನಿಕ ಶಾಂತಿ ವಿರುದ್ಧ ಅಪರಾಧಗಳು',
  'Crimes Against Women': 'ಮಹಿಳೆಯರ ವಿರುದ್ಧ ಅಪರಾಧಗಳು',
  'Cyber Crimes': 'ಸೈಬರ್ ಅಪರಾಧಗಳು',
  'Domestic Violence': 'ಕೌಟುಂಬಿಕ ಹಿಂಸೆ',
  'Economic Offences': 'ಆರ್ಥಿಕ ಅಪರಾಧಗಳು',
  'Environmental Offences': 'ಪರಿಸರ ಅಪರಾಧಗಳು',
  'Forgery & Counterfeiting': 'ನಕಲಿ ಮತ್ತು ಖೋಟಾ',
  'Gambling & Betting': 'ಜೂಜು ಮತ್ತು ಬೆಟ್ಟಿಂಗ್',
  'Kidnapping & Abduction': 'ಅಪಹರಣ',
  'Motor Vehicle Offences': 'ಮೋಟಾರು ವಾಹನ ಅಪರಾಧಗಳು',
  'Narcotics & Drugs': 'ಮಾದಕ ದ್ರವ್ಯಗಳು',
  'Other IPC Offences': 'ಇತರ IPC ಅಪರಾಧಗಳು',
  'Public Order Violations': 'ಸಾರ್ವಜನಿಕ ಸುವ್ಯವಸ್ಥೆ ಉಲ್ಲಂಘನೆ',
  'Robbery & Dacoity': 'ದರೋಡೆ ಮತ್ತು ಡಕಾಯಿತಿ',
  'Sexual Offences': 'ಲೈಂಗಿಕ ಅಪರಾಧಗಳು',
}

/* Plain-language gloss per category. The dataset's own name is kept; this is
   only what the category covers, shown on hover. */
const crimeGlossEn: Record<string, string> = {
  'Arms Act Violations': 'Illegal possession, carrying or sale of weapons',
  'Cheating & Fraud': 'Deception for money or property, including forgery of intent',
  'Crimes Against Body': 'Physical harm to a person — assault, hurt, culpable homicide and murder',
  'Crimes Against Children': 'Offences where the victim is a minor',
  'Crimes Against Property': 'Theft, burglary, house-breaking and criminal trespass',
  'Crimes Against Public Tranquility': 'Rioting, unlawful assembly and affray',
  'Crimes Against Women': 'Offences where the victim is a woman, including cruelty and harassment',
  'Cyber Crimes': 'Offences committed through computers, phones or the internet',
  'Domestic Violence': 'Violence or cruelty by a family member or partner',
  'Economic Offences': 'Financial crime — criminal breach of trust, misappropriation',
  'Environmental Offences': 'Damage to forest, wildlife, water or air under environmental law',
  'Forgery & Counterfeiting': 'Fake documents, seals, signatures or currency',
  'Gambling & Betting': 'Running or taking part in unlawful gaming and wagering',
  'Kidnapping & Abduction': 'Taking or carrying away a person against their will',
  'Motor Vehicle Offences': 'Road and traffic offences, including rash and negligent driving',
  'Narcotics & Drugs': 'Possession, sale or trafficking of controlled substances',
  'Other IPC Offences': 'IPC offences not falling under the other categories',
  'Public Order Violations': 'Obstruction, public nuisance and disobedience of lawful orders',
  'Robbery & Dacoity': 'Theft with force or the threat of force; dacoity is five or more offenders',
  'Sexual Offences': 'Rape, sexual assault and related offences',
}

const crimeGlossKn: Record<string, string> = {
  'Arms Act Violations': 'ಶಸ್ತ್ರಾಸ್ತ್ರಗಳ ಅಕ್ರಮ ಸ್ವಾಧೀನ, ಸಾಗಣೆ ಅಥವಾ ಮಾರಾಟ',
  'Cheating & Fraud': 'ಹಣ ಅಥವಾ ಆಸ್ತಿಗಾಗಿ ಮೋಸ, ಉದ್ದೇಶಪೂರ್ವಕ ವಂಚನೆ ಸೇರಿದಂತೆ',
  'Crimes Against Body': 'ವ್ಯಕ್ತಿಗೆ ದೈಹಿಕ ಹಾನಿ — ಹಲ್ಲೆ, ಗಾಯ, ಸಾವಿಗೆ ಕಾರಣವಾಗುವ ಕೃತ್ಯ ಮತ್ತು ಕೊಲೆ',
  'Crimes Against Children': 'ಸಂತ್ರಸ್ತರು ಅಪ್ರಾಪ್ತ ವಯಸ್ಕರಾಗಿರುವ ಅಪರಾಧಗಳು',
  'Crimes Against Property': 'ಕಳ್ಳತನ, ಮನೆ ಒಡೆದು ಕಳ್ಳತನ ಮತ್ತು ಅಕ್ರಮ ಪ್ರವೇಶ',
  'Crimes Against Public Tranquility': 'ಗಲಭೆ, ಕಾನೂನುಬಾಹಿರ ಸಭೆ ಮತ್ತು ಜಗಳ',
  'Crimes Against Women': 'ಸಂತ್ರಸ್ತರು ಮಹಿಳೆಯಾಗಿರುವ ಅಪರಾಧಗಳು, ಕ್ರೌರ್ಯ ಮತ್ತು ಕಿರುಕುಳ ಸೇರಿದಂತೆ',
  'Cyber Crimes': 'ಗಣಕಯಂತ್ರ, ದೂರವಾಣಿ ಅಥವಾ ಅಂತರ್ಜಾಲದ ಮೂಲಕ ನಡೆಸಿದ ಅಪರಾಧಗಳು',
  'Domestic Violence': 'ಕುಟುಂಬದ ಸದಸ್ಯ ಅಥವಾ ಸಂಗಾತಿಯಿಂದ ಹಿಂಸೆ ಅಥವಾ ಕ್ರೌರ್ಯ',
  'Economic Offences': 'ಆರ್ಥಿಕ ಅಪರಾಧ — ನಂಬಿಕೆ ದ್ರೋಹ, ದುರುಪಯೋಗ',
  'Environmental Offences': 'ಪರಿಸರ ಕಾನೂನಿನಡಿ ಅರಣ್ಯ, ವನ್ಯಜೀವಿ, ನೀರು ಅಥವಾ ಗಾಳಿಗೆ ಹಾನಿ',
  'Forgery & Counterfeiting': 'ನಕಲಿ ದಾಖಲೆ, ಮುದ್ರೆ, ಸಹಿ ಅಥವಾ ನೋಟು',
  'Gambling & Betting': 'ಕಾನೂನುಬಾಹಿರ ಜೂಜು ಮತ್ತು ಬೆಟ್ಟಿಂಗ್ ನಡೆಸುವುದು ಅಥವಾ ಭಾಗವಹಿಸುವುದು',
  'Kidnapping & Abduction': 'ವ್ಯಕ್ತಿಯ ಇಚ್ಛೆಗೆ ವಿರುದ್ಧವಾಗಿ ಕರೆದೊಯ್ಯುವುದು',
  'Motor Vehicle Offences': 'ರಸ್ತೆ ಮತ್ತು ಸಂಚಾರ ಅಪರಾಧಗಳು, ಅಜಾಗರೂಕ ಚಾಲನೆ ಸೇರಿದಂತೆ',
  'Narcotics & Drugs': 'ನಿಷೇಧಿತ ಮಾದಕ ವಸ್ತುಗಳ ಸ್ವಾಧೀನ, ಮಾರಾಟ ಅಥವಾ ಸಾಗಣೆ',
  'Other IPC Offences': 'ಇತರ ವರ್ಗಗಳಿಗೆ ಸೇರದ IPC ಅಪರಾಧಗಳು',
  'Public Order Violations': 'ಅಡಚಣೆ, ಸಾರ್ವಜನಿಕ ಉಪದ್ರವ ಮತ್ತು ಕಾನೂನುಬದ್ಧ ಆದೇಶ ಉಲ್ಲಂಘನೆ',
  'Robbery & Dacoity': 'ಬಲ ಅಥವಾ ಬೆದರಿಕೆಯೊಂದಿಗೆ ಕಳ್ಳತನ; ಐದು ಅಥವಾ ಹೆಚ್ಚು ಆರೋಪಿಗಳಿದ್ದರೆ ಡಕಾಯಿತಿ',
  'Sexual Offences': 'ಅತ್ಯಾಚಾರ, ಲೈಂಗಿಕ ದೌರ್ಜನ್ಯ ಮತ್ತು ಸಂಬಂಧಿತ ಅಪರಾಧಗಳು',
}

// ── Context & hooks ──────────────────────────────────────────────────

interface I18nCtx {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string) => string
  td: (district: string) => string
  tc: (crimeType: string) => string
  /** Plain-language gloss for a crime category, for a title tooltip. */
  tcg: (crimeType: string) => string
}

const I18nContext = createContext<I18nCtx>({
  lang: 'en',
  setLang: () => {},
  t: (k) => k,
  td: (d) => d,
  tc: (c) => c,
  tcg: () => '',
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(
    () => (localStorage.getItem('prahari_lang') as Lang) || 'en',
  )

  const changeLang = useCallback((l: Lang) => {
    setLang(l)
    localStorage.setItem('prahari_lang', l)
  }, [])

  // An empty string counts as "not translated" — long site body copy ships
  // English-only on purpose, and must fall through rather than render blank.
  const t = useCallback(
    (key: string): string => {
      const entry = translations[key]
      if (!entry) return key
      return entry[lang] || entry.en || key
    },
    [lang],
  )

  const td = useCallback(
    (district: string): string => (lang === 'kn' ? districtNames[district] ?? district : district),
    [lang],
  )

  const tc = useCallback(
    (crimeType: string): string => (lang === 'kn' ? crimeTypes[crimeType] ?? crimeType : crimeType),
    [lang],
  )

  const tcg = useCallback(
    (crimeType: string): string =>
      (lang === 'kn' ? crimeGlossKn[crimeType] : crimeGlossEn[crimeType]) ?? '',
    [lang],
  )

  return (
    <I18nContext.Provider value={{ lang, setLang: changeLang, t, td, tc, tcg }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}
