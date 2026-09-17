import { h, render } from 'preact';
import { App } from './App.js';
import './style.css';

const root = document.getElementById('root');
if (root) {
  render(<App />, root);
}
