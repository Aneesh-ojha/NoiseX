/**
 * NoiseX — Interactive Waveform Renderer
 */
export class WaveformRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
  }

  render(buffer, color = '#00F0FF') {
    const W = this.canvas.width  = this.canvas.offsetWidth  || 400;
    const H = this.canvas.height = this.canvas.offsetHeight || 80;

    this.ctx.clearRect(0, 0, W, H);

    // Center line
    this.ctx.beginPath();
    this.ctx.moveTo(0, H / 2);
    this.ctx.lineTo(W, H / 2);
    this.ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();

    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / W);
    const amp  = H / 2;

    this.ctx.beginPath();
    this.ctx.moveTo(0, amp);

    for (let i = 0; i < W; i++) {
      let min = 1.0, max = -1.0;
      for (let j = 0; j < step; j++) {
        const d = data[i * step + j];
        if (d < min) min = d;
        if (d > max) max = d;
      }
      this.ctx.lineTo(i, (1 + min) * amp);
      this.ctx.lineTo(i, (1 + max) * amp);
    }

    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
  }

  drawPlayhead(percent) {
    const x = this.canvas.width * percent;
    this.ctx.beginPath();
    this.ctx.moveTo(x, 0);
    this.ctx.lineTo(x, this.canvas.height);
    this.ctx.strokeStyle = '#FFB300';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();
  }
}
