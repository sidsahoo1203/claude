// Chart.js registration + dark theme defaults shared by every chart.
import {
  Chart,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';

Chart.register(BarController, BarElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend);

export const SURFACE = '#161a2c';
export const INK = { primary: '#e8eaf2', secondary: '#b4b9cc', muted: '#9097ad' };
export const GRID = 'rgba(255,255,255,0.06)';
// Single sequential hue (blue), dark surface: near-zero recedes toward the surface, high is light.
export const SEQ_BLUE = ['#104281', '#1c5cab', '#2a78d6', '#5598e7', '#9ec5f4'];
export const SERIES_A = '#3987e5';
export const SERIES_B = '#8b93ad';

Chart.defaults.color = INK.muted;
Chart.defaults.font.family = "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.borderColor = GRID;
Chart.defaults.maintainAspectRatio = false;
Chart.defaults.animation.duration = 250;
Chart.defaults.plugins.legend.labels.color = INK.secondary;
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.pointStyle = 'rectRounded';
Chart.defaults.plugins.legend.labels.boxHeight = 8;
Chart.defaults.plugins.legend.labels.boxWidth = 8;
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(12,14,26,0.95)';
Chart.defaults.plugins.tooltip.borderColor = 'rgba(255,255,255,0.15)';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.titleColor = INK.primary;
Chart.defaults.plugins.tooltip.bodyColor = INK.secondary;
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.boxPadding = 4;
Chart.defaults.plugins.tooltip.usePointStyle = true;

// Recessive axes: no axis lines, faint grid only on the value axis.
export function axes({ yMax, yTitle, xGrid = false, stacked = false, yTicks = {} } = {}) {
  return {
    x: { stacked, grid: { display: xGrid, color: GRID }, border: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 12 } },
    y: {
      stacked,
      beginAtZero: true,
      max: yMax,
      grid: { color: GRID },
      border: { display: false },
      title: yTitle ? { display: true, text: yTitle, color: INK.muted } : undefined,
      ticks: { precision: 0, ...yTicks },
    },
  };
}

export { Chart };
