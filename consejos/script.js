fetch('./consejos.json')
  .then(response => response.json())
  .then(data => {
    const tips = data.tips;
    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    document.write(randomTip);
  })
  .catch(() => {
    document.write('Error');
  });
