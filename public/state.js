export const state = {
  voiceEnabled: true,
  driverMinderActive: false,
  towModeActive: false,
  motionStarted: false,
  emergencyActive: false,
  emergencyRunning: false,
  listeningForCommand: false,
  systemUnlocked: false,
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
  safetyVoiceActive: false
};
