// =============================================================
// LANDING.JS – 30-Day Countdown Timer & Landing Logic
// =============================================================

(function startTimer() {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 29);

  const timerDisplay = document.getElementById('timer-display');
  if (!timerDisplay) return;

  function updateTimer() {
    const diff = targetDate.getTime() - new Date().getTime();
    if (diff > 0) {
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      timerDisplay.innerText =
        `${String(days).padStart(2, '0')}d : ${String(hours).padStart(2, '0')}h : ${String(minutes).padStart(2, '0')}m : ${String(seconds).padStart(2, '0')}s`;
    } else {
      timerDisplay.innerText = "Registration Closed";
    }
  }

  updateTimer();
  setInterval(updateTimer, 1000);
})();