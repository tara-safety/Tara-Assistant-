export const state = {
  hazardWatchActive: false,
  roadsideReminderTimer: null,
  hazardReminderTimer: null,
  lastHazardWarningAt: 0,
  emergencyActive: false,
  holdTimer: null,
  touchStarted: false,
  alarmAudio: null,
  sirenAudioContext: null,
  sirenOscillator: null,
  sirenGain: null,
  sirenInterval: null,
  voiceEnabled: true,
  towModeActive: false,
  driverMinderActive: false,
  highRiskMode: false,
  emergencyRunning: false,
  proMode: false,

  recognition: null,
  listeningForCommand: false,

  safetyRecognition: null,
  safetyVoiceActive: false,

  soundWatchActive: false,

  contextMode: "idle",
  watchId: null,

  pendingContext: null,
  pendingContextSince: 0,
  lastContextChangeAt: 0,

  lastMotionLevel: 0,
  motionActivityScore: 0,
  lastMovementTime: 0,

  lastImpactTime: 0,

  motionStarted: false,
  inactivityTimer: null,

  warningRunning: false,
  warningStartedAt: 0,
  warningClearHits: 0,
  warningTimeout: null,
  lastWarningClearedAt: 0,

  wakeLock: null
};
