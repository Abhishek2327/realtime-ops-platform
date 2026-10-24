// src/utils/eventBus.js
import { EventEmitter } from 'events';

// Single shared EventEmitter instance
export const eventBus = new EventEmitter();

// Set max listeners to prevent memory leak warnings in tests/production
eventBus.setMaxListeners(1000);
