// Simple script to generate basic notification sounds using Web Audio API
// This would typically be run in a browser console or as part of a build process

const generateNotificationSound = (frequency, duration, type = 'sine') => {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.value = frequency;
  oscillator.type = type;
  
  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);
};

// Generate different notification sounds
const sounds = {
  notification: () => generateNotificationSound(800, 0.2),
  message: () => {
    generateNotificationSound(600, 0.1);
    setTimeout(() => generateNotificationSound(800, 0.1), 100);
  },
  friendRequest: () => {
    generateNotificationSound(500, 0.15);
    setTimeout(() => generateNotificationSound(700, 0.15), 150);
    setTimeout(() => generateNotificationSound(900, 0.15), 300);
  },
  like: () => generateNotificationSound(1000, 0.1),
  comment: () => {
    generateNotificationSound(700, 0.1);
    setTimeout(() => generateNotificationSound(900, 0.1), 100);
  },
  system: () => {
    generateNotificationSound(400, 0.2);
    setTimeout(() => generateNotificationSound(600, 0.2), 200);
  }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = sounds;
}