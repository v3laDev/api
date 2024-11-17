async function loadTip() {
    try {
      const response = await fetch('consejos.json');
      const data = await response.json();
      const tips = data.consejos;
      const randomTip = tips[Math.floor(Math.random() * tips.length)];
      document.getElementById('tip').innerText = randomTip;
    } catch (error) {
      document.getElementById('tip').innerText = 'Error loading the tip.';
    }
  }
  
  loadTip();
  
