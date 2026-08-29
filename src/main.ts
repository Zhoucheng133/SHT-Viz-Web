import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
const pinia = createPinia();
import 'primeicons/primeicons.css';
import "./style.css";

const app = createApp(App);
app.use(pinia)
app.mount('#app')
