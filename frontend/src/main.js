import { createApp, defineCustomElement } from 'vue';
import App from './App.vue';
import MIcon from './components/MIcon.vue';
import './style.css';

if (!customElements.get('m-icon')) customElements.define('m-icon', defineCustomElement(MIcon));
createApp(App).mount('#root');
