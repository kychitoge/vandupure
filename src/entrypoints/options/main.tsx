import { h, render } from 'preact';
import { App } from './App.js';
import './style.css';

const container = document.getElementById('app');
if (container) {
  render(<App />, container);
}
