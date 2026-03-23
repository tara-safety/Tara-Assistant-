export const state = {
  voiceEnabled: true,
  driverMinderActive: false,
  towModeActive: false,
  motionStarted: false,
  emergencyActive: false,
  emergencyRunning: false,
  listeningForCommand: false,
  systemUnlocked: false,
  touchStarted: false,
  lastImpactTime: 0,
  inactivityTimer: null,
  holdTimer: null,
  alarmAudio: null,
  recognition: null,

  warningRunning: false,
  warningTimeout: null,

  wakeLock: null,

  warningStartedAt: 0,
  warningClearHits: 0,

  safetyRecognition: null,
  safetyVoiceActive: false,

  contextMode: "idle",
  watchId: null,
  lastMotionLevel: 0,
  motionActivityScore: 0,
  lastMovementTime: 0,

  // High-Risk Mode
  highRiskMode: false,
  sirenAudioContext: null,
  sirenOscillator: null,
  sirenGain: null,
  sirenInterval: null
};
